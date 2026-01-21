//! IPC types for JSON-RPC communication with Python backend

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// JSON-RPC 2.0 Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcRequest {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(default)]
    pub params: HashMap<String, serde_json::Value>,
}

impl RpcRequest {
    pub fn new(method: &str, params: HashMap<String, serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            id: Some(uuid::Uuid::new_v4().to_string()),
            params,
        }
    }

    pub fn notification(method: &str, params: HashMap<String, serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            id: None,
            params,
        }
    }
}

/// JSON-RPC 2.0 Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
}

/// JSON-RPC 2.0 Error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// JSON-RPC 2.0 Notification (from Python to Rust)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(default)]
    pub params: serde_json::Value,
}

/// Message received from Python (either Response or Notification)
#[derive(Debug, Clone)]
pub enum PythonMessage {
    Response(RpcResponse),
    Notification(RpcNotification),
}

impl PythonMessage {
    pub fn parse(json_str: &str) -> Result<Self, serde_json::Error> {
        // Try to parse as a response first (has "result" or "error" and "id")
        if let Ok(response) = serde_json::from_str::<RpcResponse>(json_str) {
            if response.id.is_some() || response.result.is_some() || response.error.is_some() {
                return Ok(PythonMessage::Response(response));
            }
        }
        
        // Otherwise parse as notification
        let notification: RpcNotification = serde_json::from_str(json_str)?;
        Ok(PythonMessage::Notification(notification))
    }
}
