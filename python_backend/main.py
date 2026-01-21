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

# Add the backend directory to the path for imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

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
