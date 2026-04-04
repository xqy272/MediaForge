"""
MediaForge Python Backend
Main entry point that starts the RPC server with all handlers
"""
import sys
import os

# Windows stdin fix: reconfigure stdin/stdout for proper UTF-8 and buffering
if sys.platform == 'win32':
    # Set stdin to binary mode for proper line reading
    import msvcrt
    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    
    # Reconfigure stdin with proper encoding
    sys.stdin = open(sys.stdin.fileno(), 'r', encoding='utf-8', errors='replace', newline='\n')
    
    # Also reconfigure stdout for UTF-8 output
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# --- Suppress ONNX Runtime C++ native logging ---
# ORT's C++ runtime logs to stdout by default, which corrupts our NDJSON protocol.
# Must be set BEFORE any onnxruntime import or session creation.
try:
    import onnxruntime as ort
    ort.set_default_logger_severity(3)  # Only Error and Fatal
except ImportError:
    pass  # onnxruntime not installed yet

# --- Stdout guard ---
# Protect stdout from accidental print() calls by third-party libraries.
# Only valid NDJSON (lines starting with '{') are allowed through.
import threading

class _StdoutGuard:
    """Intercepts writes to stdout, only allowing JSON lines through."""
    def __init__(self, real_stdout):
        self._real = real_stdout
        self._lock = threading.Lock()
        self.encoding = getattr(real_stdout, 'encoding', 'utf-8')

    def write(self, data: str) -> int:
        if not data or not data.strip():
            return len(data) if data else 0
        # Only allow lines that look like JSON (start with '{')
        for line in data.splitlines(True):
            stripped = line.strip()
            if stripped.startswith('{'):
                with self._lock:
                    self._real.write(line)
                    self._real.flush()
            elif stripped:
                # Redirect non-JSON output to stderr
                sys.stderr.write(line)
        return len(data)

    def flush(self):
        self._real.flush()

    def fileno(self):
        return self._real.fileno()

    def isatty(self):
        return False

    def writable(self):
        return True

    # Forward reconfigure for compatibility
    def reconfigure(self, **kwargs):
        if hasattr(self._real, 'reconfigure'):
            self._real.reconfigure(**kwargs)

_real_stdout = sys.stdout
sys.stdout = _StdoutGuard(_real_stdout)

# Add the backend directory to the path for imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Pre-add DLL directories for native extensions (cv2, numpy) on Windows
# This is needed for bundled/embedded Python where DLL search paths
# may not include the package directories
if sys.platform == 'win32':
    try:
        python_dir = os.path.dirname(sys.executable)
        site_packages = os.path.join(python_dir, 'Lib', 'site-packages')
        # Add python root dir for vcruntime DLLs
        if os.path.isdir(python_dir):
            os.add_dll_directory(python_dir)
        # Add cv2 dir for opencv FFmpeg DLL
        cv2_dir = os.path.join(site_packages, 'cv2')
        if os.path.isdir(cv2_dir):
            os.add_dll_directory(cv2_dir)
        # Add numpy.libs if exists
        numpy_libs = os.path.join(site_packages, 'numpy.libs')
        if os.path.isdir(numpy_libs):
            os.add_dll_directory(numpy_libs)
    except Exception:
        pass  # os.add_dll_directory not available on older Python

# Import and start watchdog first
import watchdog

# Import portable configuration
from utils import portable

# Import server and handlers
from server import server
import rpc_handlers  # This registers all the RPC methods

if __name__ == "__main__":
    # Start the RPC server
    server.run()
