"""
Watchdog module for monitoring parent process
Ensures Python backend terminates when Tauri app closes
"""
import os
import sys
import signal
import threading
import time
import logging

logger = logging.getLogger('MediaForge.Watchdog')


def is_process_alive(pid: int) -> bool:
    """Check if a process with the given PID is still running"""
    if pid <= 0:
        return False
    
    if sys.platform == 'win32':
        # Windows: use ctypes to check if process exists
        try:
            import ctypes
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            STILL_ACTIVE = 259
            
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if handle == 0:
                # Process doesn't exist or access denied
                return False
            
            try:
                exit_code = ctypes.c_ulong()
                if kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
                    return exit_code.value == STILL_ACTIVE
                return False
            finally:
                kernel32.CloseHandle(handle)
        except Exception as e:
            logger.error(f"Failed to check process {pid}: {e}")
            return True  # Assume alive on error to avoid premature exit
    else:
        # Unix: use os.kill with signal 0
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


def start_watchdog():
    """Start watchdog thread to monitor parent process"""
    parent_pid = int(os.environ.get('MEDIAFORGE_PARENT_PID', 0))
    
    if parent_pid == 0:
        logger.warning("No parent PID provided, watchdog disabled")
        return
    
    logger.info(f"Starting watchdog for parent PID: {parent_pid}")
    
    def check_parent():
        while True:
            time.sleep(2)
            if not is_process_alive(parent_pid):
                logger.info("Parent process terminated, exiting")
                os._exit(0)
    
    thread = threading.Thread(target=check_parent, daemon=True, name="Watchdog")
    thread.start()


def setup_signal_handlers():
    """Setup graceful shutdown signal handlers"""
    def handle_shutdown(signum, frame):
        logger.info(f"Received signal {signum}, shutting down")
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)
    
    # Windows doesn't have SIGHUP
    if hasattr(signal, 'SIGHUP'):
        signal.signal(signal.SIGHUP, handle_shutdown)


# Auto-start watchdog when imported
start_watchdog()
setup_signal_handlers()
