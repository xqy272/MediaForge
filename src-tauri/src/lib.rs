//! MediaForge Tauri Backend

mod python;

use python::PythonManager;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, Manager, State};

/// Application state
pub struct AppState {
    python: Arc<PythonManager>,
}

/// Initialize Python backend
#[tauri::command]
async fn init_python(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    if !state.python.is_running() {
        let resource_dir = app.path().resource_dir().ok();
        state
            .python
            .start(resource_dir)
            .map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({"status": "ok"}))
}

/// Call Python RPC method
#[tauri::command]
async fn python_call(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    method: String,
    params: HashMap<String, serde_json::Value>,
) -> Result<serde_json::Value, String> {
    if !state.python.is_running() {
        let resource_dir = app.path().resource_dir().ok();
        state
            .python
            .start(resource_dir)
            .map_err(|e| e.to_string())?;
    }

    state
        .python
        .call(&method, params)
        .await
        .map_err(|e| e.to_string())
}

/// Check Python status
#[tauri::command]
fn python_status(state: State<'_, AppState>) -> serde_json::Value {
    serde_json::json!({
        "running": state.python.is_running()
    })
}

/// Stop Python backend
#[tauri::command]
fn stop_python(state: State<'_, AppState>) {
    state.python.stop();
}

/// Get models directory path (works without Python)
#[tauri::command]
fn get_models_dir(app: tauri::AppHandle) -> Result<String, String> {
    let models_dir = resolve_models_dir(&app);

    // Ensure directory exists
    if let Err(e) = std::fs::create_dir_all(&models_dir) {
        return Err(format!("Failed to create models directory: {}", e));
    }

    Ok(models_dir.to_string_lossy().to_string())
}

/// Open models directory in system file explorer
#[tauri::command]
fn open_models_dir(app: tauri::AppHandle) -> Result<(), String> {
    let models_dir = resolve_models_dir(&app);

    // Ensure directory exists
    std::fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(models_dir.as_os_str())
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&models_dir)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&models_dir)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    Ok(())
}

fn resolve_models_dir(_app: &tauri::AppHandle) -> std::path::PathBuf {
    if cfg!(debug_assertions) {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default();
        exe_dir
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .map(|p| p.join("models"))
            .unwrap_or_else(|| std::path::PathBuf::from("models"))
    } else {
        // Release: try exe dir first, fall back to LOCALAPPDATA
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default();
        let candidate = exe_dir.join("models");

        // Check if exe dir is writable (e.g. not in Program Files)
        if std::fs::create_dir_all(&candidate).is_ok() {
            candidate
        } else {
            // Use LOCALAPPDATA/MediaForge/models
            let local_app_data = std::env::var("LOCALAPPDATA")
                .unwrap_or_else(|_| String::from("."));
            std::path::PathBuf::from(local_app_data)
                .join("MediaForge")
                .join("models")
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let python_manager = Arc::new(PythonManager::new());

    // Clone for the notification callback
    let python_for_callback = Arc::clone(&python_manager);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            python: python_manager,
        })
        .setup(move |app| {
            // Set up notification callback to emit events to frontend
            let app_handle = app.handle().clone();
            python_for_callback.set_notification_callback(move |method, params| {
                match method.as_str() {
                    "progress" => {
                        let _ = app_handle.emit("python-progress", params);
                    }
                    "log" => {
                        let _ = app_handle.emit("python-log", params);
                    }
                    _ => {
                        let _ = app_handle.emit(&format!("python-{}", method), params);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_python,
            python_call,
            python_status,
            stop_python,
            get_models_dir,
            open_models_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
