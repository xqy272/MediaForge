//! Python process manager
//! Handles spawning, communication, and lifecycle of the Python backend

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use super::ipc::{PythonMessage, RpcRequest, RpcResponse};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Error types for Python manager
#[derive(Debug, thiserror::Error)]
pub enum PythonError {
    #[error("Python process not started")]
    NotStarted,
    #[error("Failed to start Python process: {0}")]
    StartFailed(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("RPC error: {0}")]
    RpcError(String),
    #[error("Timeout waiting for response")]
    Timeout,
}

type NotificationCallback = Arc<dyn Fn(String, serde_json::Value) + Send + Sync>;

/// Manages the Python backend process
pub struct PythonManager {
    child: Arc<Mutex<Option<Child>>>,
    stdin: Arc<Mutex<Option<std::process::ChildStdin>>>,
    pending_responses: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<RpcResponse>>>>,
    notification_callback: Arc<Mutex<Option<NotificationCallback>>>,
    running: Arc<AtomicBool>,
    starting: Arc<AtomicBool>,
}

impl PythonManager {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            stdin: Arc::new(Mutex::new(None)),
            pending_responses: Arc::new(Mutex::new(HashMap::new())),
            notification_callback: Arc::new(Mutex::new(None)),
            running: Arc::new(AtomicBool::new(false)),
            starting: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Get the path to the Python executable
    fn get_python_path(resource_dir: Option<&PathBuf>) -> PathBuf {
        // For development, use the virtual environment Python
        if cfg!(debug_assertions) {
            // Get project root for venv path
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_default();

            // Development: exe is at src-tauri/target/debug/mediaforge.exe
            // Go up to project root and find venv
            let project_root = exe_dir
                .parent() // target/debug -> target
                .and_then(|p| p.parent()) // target -> src-tauri
                .and_then(|p| p.parent()); // src-tauri -> project root

            if let Some(root) = project_root {
                let venv_python = root
                    .join("python_backend")
                    .join("venv")
                    .join("Scripts")
                    .join("python.exe");
                if venv_python.exists() {
                    log::info!("Using venv Python: {:?}", venv_python);
                    return venv_python;
                }
            }

            // Fallback to system Python if venv not found
            log::warn!("Virtual environment not found, using system Python");
            PathBuf::from("python")
        } else {
            // Release: try exe directory first, then resource_dir
            let candidates = Self::get_candidate_dirs(resource_dir);
            for base in &candidates {
                let python = base
                    .join("python_dist")
                    .join("python")
                    .join("python.exe");
                if python.exists() {
                    log::info!("Found Python at: {:?}", python);
                    return python;
                }
            }
            // Fallback (will fail but provides a meaningful error)
            let fallback = candidates
                .first()
                .cloned()
                .unwrap_or_default()
                .join("python_dist")
                .join("python")
                .join("python.exe");
            log::error!("Python not found! Candidates: {:?}", candidates);
            fallback
        }
    }

    /// Get the path to the Python backend script
    fn get_backend_path(resource_dir: Option<&PathBuf>) -> PathBuf {
        if cfg!(debug_assertions) {
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_default();

            // Development: exe is at src-tauri/target/debug/mediaforge.exe
            // We need to go up to src-tauri, then to project root
            exe_dir
                .parent() // src-tauri/target/debug -> src-tauri/target
                .and_then(|p| p.parent()) // src-tauri/target -> src-tauri
                .and_then(|p| p.parent()) // src-tauri -> project root (MediaForge)
                .map(|p| p.join("python_backend").join("main.py"))
                .unwrap_or_else(|| PathBuf::from("python_backend/main.py"))
        } else {
            let candidates = Self::get_candidate_dirs(resource_dir);
            for base in &candidates {
                let main_py = base
                    .join("python_dist")
                    .join("backend")
                    .join("main.py");
                if main_py.exists() {
                    log::info!("Found backend at: {:?}", main_py);
                    return main_py;
                }
            }
            let fallback = candidates
                .first()
                .cloned()
                .unwrap_or_default()
                .join("python_dist")
                .join("backend")
                .join("main.py");
            log::error!("Backend not found! Candidates: {:?}", candidates);
            fallback
        }
    }

    /// Get candidate base directories to search for python_dist
    fn get_candidate_dirs(resource_dir: Option<&PathBuf>) -> Vec<PathBuf> {
        let mut dirs = Vec::new();

        // 1. Exe directory (MSI installs python_dist next to exe)
        if let Some(exe_dir) = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        {
            dirs.push(exe_dir);
        }

        // 2. Resource directory (Tauri resource_dir)
        if let Some(rd) = resource_dir {
            if !dirs.contains(rd) {
                dirs.push(rd.clone());
            }
        }

        dirs
    }

    /// Start the Python backend process
    pub fn start(&self, resource_dir: Option<PathBuf>) -> Result<(), PythonError> {
        // Atomic guard: try to claim the starting flag
        // compare_exchange_weak: if false, set to true and proceed; if true, someone else is starting
        if self
            .starting
            .compare_exchange_weak(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            log::info!("Python backend is already being started, skipping");
            return Ok(());
        }

        // Check if already running
        if self.running.load(Ordering::SeqCst) {
            self.starting.store(false, Ordering::SeqCst);
            log::info!("Python backend already running, skipping start");
            return Ok(());
        }

        // Check if there's already a child process
        {
            let child = self.child.lock().unwrap();
            if child.is_some() {
                self.starting.store(false, Ordering::SeqCst);
                log::info!("Python child process exists, skipping start");
                return Ok(());
            }
        }

        let python_path = Self::get_python_path(resource_dir.as_ref());
        let backend_path = Self::get_backend_path(resource_dir.as_ref());

        log::info!(
            "Starting Python backend: {:?} {:?}",
            python_path,
            backend_path
        );

        let mut cmd = Command::new(&python_path);

        // Add python_dist directories to PATH so native extensions (cv2, numpy)
        // can find their DLL dependencies in the bundled environment
        if let Some(python_dir) = python_path.parent() {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let mut new_path = format!("{}", python_dir.display());

            // Also add cv2 directory for opencv_videoio_ffmpeg DLL
            let cv2_dir = python_dir
                .join("Lib")
                .join("site-packages")
                .join("cv2");
            if cv2_dir.exists() {
                new_path = format!("{};{}", new_path, cv2_dir.display());
            }

            new_path = format!("{};{}", new_path, current_path);
            cmd.env("PATH", new_path);
        }

        cmd.arg(&backend_path)
            .env("MEDIAFORGE_PARENT_PID", std::process::id().to_string())
            .env("MEDIAFORGE_PORTABLE", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        {
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| PythonError::StartFailed(e.to_string()))?;

        let stdin = child
            .stdin
            .take()
            .ok_or(PythonError::StartFailed("No stdin".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or(PythonError::StartFailed("No stdout".into()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or(PythonError::StartFailed("No stderr".into()))?;

        // Store handles
        *self.child.lock().unwrap() = Some(child);
        *self.stdin.lock().unwrap() = Some(stdin);
        self.running.store(true, Ordering::SeqCst);
        self.starting.store(false, Ordering::SeqCst);

        // Start stdout reader thread
        let pending = Arc::clone(&self.pending_responses);
        let notification_cb = Arc::clone(&self.notification_callback);
        let running = Arc::clone(&self.running);

        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if !running.load(Ordering::SeqCst) {
                    break;
                }

                match line {
                    Ok(line) if !line.is_empty() => match PythonMessage::parse(&line) {
                        Ok(PythonMessage::Response(response)) => {
                            if let Some(id) = &response.id {
                                if let Some(sender) = pending.lock().unwrap().remove(id) {
                                    let _ = sender.send(response);
                                }
                            }
                        }
                        Ok(PythonMessage::Notification(notification)) => {
                            if let Some(cb) = notification_cb.lock().unwrap().as_ref() {
                                cb(notification.method, notification.params);
                            }
                        }
                        Err(e) => {
                            log::error!("Failed to parse Python message: {} - {}", e, line);
                        }
                    },
                    Err(e) => {
                        log::error!("Error reading from Python: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            log::info!("Python stdout reader stopped");
        });

        // Start stderr reader thread
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) => log::info!("[Python] {}", line),
                    Err(_) => break,
                }
            }
        });

        log::info!("Python backend started successfully");
        Ok(())
    }

    /// Stop the Python backend process
    pub fn stop(&self) {
        log::info!("Stopping Python backend...");

        self.running.store(false, Ordering::SeqCst);

        // Try graceful shutdown first
        if let Err(e) = self.send_notification("shutdown", HashMap::new()) {
            log::warn!("Failed to send shutdown: {}", e);
        }

        // Give it a moment to shutdown gracefully
        std::thread::sleep(std::time::Duration::from_millis(500));

        // Force kill if still running
        if let Some(mut child) = self.child.lock().unwrap().take() {
            match child.try_wait() {
                Ok(Some(_)) => log::info!("Python exited gracefully"),
                Ok(None) => {
                    log::warn!("Force killing Python process");
                    let _ = child.kill();
                }
                Err(e) => log::error!("Error checking Python status: {}", e),
            }
        }
    }

    /// Set callback for notifications from Python
    pub fn set_notification_callback<F>(&self, callback: F)
    where
        F: Fn(String, serde_json::Value) + Send + Sync + 'static,
    {
        *self.notification_callback.lock().unwrap() = Some(Arc::new(callback));
    }

    /// Send a request and wait for response
    pub async fn call(
        &self,
        method: &str,
        params: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, PythonError> {
        let request = RpcRequest::new(method, params);
        let id = request.id.clone().unwrap();

        // Create response channel
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.pending_responses
            .lock()
            .unwrap()
            .insert(id.clone(), tx);

        // Send request
        self.send_request(&request)?;

        // Wait for response with timeout
        match tokio::time::timeout(std::time::Duration::from_secs(300), rx).await {
            Ok(Ok(response)) => {
                if let Some(error) = response.error {
                    Err(PythonError::RpcError(error.message))
                } else {
                    Ok(response.result.unwrap_or(serde_json::Value::Null))
                }
            }
            Ok(Err(_)) => Err(PythonError::RpcError("Response channel closed".into())),
            Err(_) => {
                self.pending_responses.lock().unwrap().remove(&id);
                Err(PythonError::Timeout)
            }
        }
    }

    /// Send a request to Python
    fn send_request(&self, request: &RpcRequest) -> Result<(), PythonError> {
        let json = serde_json::to_string(request)?;
        self.write_line(&json)
    }

    /// Send a notification to Python (no response expected)
    pub fn send_notification(
        &self,
        method: &str,
        params: HashMap<String, serde_json::Value>,
    ) -> Result<(), PythonError> {
        let request = RpcRequest::notification(method, params);
        let json = serde_json::to_string(&request)?;
        self.write_line(&json)
    }

    /// Write a line to Python stdin
    fn write_line(&self, line: &str) -> Result<(), PythonError> {
        // Check if Python process is still running before writing
        {
            let mut child_guard = self.child.lock().unwrap();
            if let Some(ref mut child) = *child_guard {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        log::error!("Python process has exited with status: {:?}", status);
                        self.running.store(false, Ordering::SeqCst);
                        return Err(PythonError::RpcError(format!(
                            "Python process exited unexpectedly with status: {:?}",
                            status
                        )));
                    }
                    Ok(None) => {
                        // Process still running, continue
                    }
                    Err(e) => {
                        log::error!("Failed to check Python process status: {}", e);
                    }
                }
            }
        }

        let mut stdin_guard = self.stdin.lock().unwrap();
        let stdin = stdin_guard.as_mut().ok_or(PythonError::NotStarted)?;

        if let Err(e) = writeln!(stdin, "{}", line) {
            log::error!("Failed to write to Python stdin: {}", e);
            self.running.store(false, Ordering::SeqCst);
            return Err(PythonError::IoError(e));
        }

        if let Err(e) = stdin.flush() {
            log::error!("Failed to flush Python stdin: {}", e);
            self.running.store(false, Ordering::SeqCst);
            return Err(PythonError::IoError(e));
        }

        Ok(())
    }

    /// Check if Python is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

impl Drop for PythonManager {
    fn drop(&mut self) {
        self.stop();
    }
}

impl Default for PythonManager {
    fn default() -> Self {
        Self::new()
    }
}
