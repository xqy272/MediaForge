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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
