//! Python process management module
mod ipc;
mod manager;

pub use manager::{ensure_python_extracted, ProgressCallback, PythonManager};
