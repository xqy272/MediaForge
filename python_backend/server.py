"""
MediaForge Python Backend Server
NDJSON-based JSON-RPC server for IPC with Tauri
"""
import sys
import json
import logging
import threading
import traceback
from typing import Any, Callable, Dict, Optional
from dataclasses import dataclass, field

# Configure logging to stderr (stdout is for RPC)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger('MediaForge')


@dataclass
class RpcRequest:
    """JSON-RPC 2.0 Request"""
    jsonrpc: str
    method: str
    id: Optional[str] = None
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RpcResponse:
    """JSON-RPC 2.0 Response"""
    jsonrpc: str = "2.0"
    id: Optional[str] = None
    result: Any = None
    error: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        d = {"jsonrpc": self.jsonrpc, "id": self.id}
        if self.error is not None:
            d["error"] = self.error
        else:
            d["result"] = self.result
        return d


class RpcServer:
    """NDJSON JSON-RPC Server"""
    
    def __init__(self):
        self.methods: Dict[str, Callable] = {}
        self.running = True
        self._lock = threading.Lock()
        
        # Register built-in methods
        self.register_method("ping", self._ping)
        self.register_method("shutdown", self._shutdown)
        self.register_method("get_version", self._get_version)
    
    def register_method(self, name: str, handler: Callable):
        """Register an RPC method handler"""
        self.methods[name] = handler
        logger.debug(f"Registered method: {name}")
    
    def _ping(self, **kwargs) -> Dict[str, Any]:
        """Health check"""
        return {"status": "ok", "message": "pong"}
    
    def _shutdown(self, **kwargs) -> Dict[str, Any]:
        """Graceful shutdown"""
        logger.info("Shutdown requested")
        self.running = False
        return {"status": "ok", "message": "shutting down"}
    
    def _get_version(self, **kwargs) -> Dict[str, Any]:
        """Get server version info"""
        return {
            "version": "2.0.0",
            "python": sys.version,
            "platform": sys.platform
        }
    
    def send_notification(self, method: str, params: Dict[str, Any]):
        """Send a notification (no response expected)"""
        notification = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        self._write_message(notification)
    
    def send_progress(self, task_id: str, progress: float, message: str = ""):
        """Send progress notification"""
        self.send_notification("progress", {
            "task_id": task_id,
            "progress": progress,
            "message": message
        })
    
    def send_log(self, level: str, message: str):
        """Send log notification"""
        self.send_notification("log", {
            "level": level,
            "message": message
        })
    
    def _write_message(self, message: Dict[str, Any]):
        """Write a message to stdout (thread-safe)"""
        with self._lock:
            try:
                json_str = json.dumps(message, ensure_ascii=False)
                print(json_str, flush=True)
            except BrokenPipeError:
                # Pipe closed by Tauri, stop the server
                self.running = False
            except OSError as e:
                # Handle Windows-specific pipe errors (error 232)
                if e.errno in (22, 32) or (hasattr(e, 'winerror') and e.winerror == 232):
                    self.running = False
                else:
                    logger.error(f"Failed to write message: {e}")
            except Exception as e:
                logger.error(f"Failed to write message: {e}")
    
    def handle_request(self, request_data: Dict[str, Any]) -> Optional[RpcResponse]:
        """Handle a single RPC request"""
        try:
            req = RpcRequest(
                jsonrpc=request_data.get("jsonrpc", "2.0"),
                method=request_data.get("method", ""),
                id=request_data.get("id"),
                params=request_data.get("params", {})
            )
            
            if req.method not in self.methods:
                return RpcResponse(
                    id=req.id,
                    error={"code": -32601, "message": f"Method not found: {req.method}"}
                )
            
            handler = self.methods[req.method]
            result = handler(**req.params)
            
            # If no id, it's a notification - no response needed
            if req.id is None:
                return None
            
            return RpcResponse(id=req.id, result=result)
            
        except Exception as e:
            logger.error(f"Error handling request: {e}")
            logger.error(traceback.format_exc())
            return RpcResponse(
                id=request_data.get("id"),
                error={"code": -32000, "message": str(e)}
            )
    
    def run(self):
        """Main server loop - read from stdin, write to stdout"""
        logger.info("MediaForge Python backend started")
        
        try:
            # Use readline() instead of iterator for unbuffered reading on Windows
            while self.running:
                try:
                    line = sys.stdin.readline()
                except Exception as e:
                    logger.error(f"Error reading stdin: {e}")
                    break
                
                if not line:  # EOF
                    logger.info("Stdin closed (EOF)")
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                try:
                    request_data = json.loads(line)
                    response = self.handle_request(request_data)
                    
                    if response is not None:
                        self._write_message(response.to_dict())
                        
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON: {e}")
                    error_response = RpcResponse(
                        error={"code": -32700, "message": f"Parse error: {e}"}
                    )
                    self._write_message(error_response.to_dict())
                    
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        except Exception as e:
            logger.error(f"Server error: {e}")
            logger.error(traceback.format_exc())
        finally:
            logger.info("MediaForge Python backend stopped")


# Global server instance
server = RpcServer()


def register_method(name: str):
    """Decorator to register an RPC method"""
    def decorator(func: Callable):
        server.register_method(name, func)
        return func
    return decorator


if __name__ == "__main__":
    server.run()
