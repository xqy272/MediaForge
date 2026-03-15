"""
Portable paths management for MediaForge
Handles model paths, config paths, and ensures portability
"""
import os
import sys
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger('MediaForge.Portable')


def get_app_dir() -> Path:
    """Get the application root directory"""
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        return Path(sys.executable).parent
    else:
        # Running as script
        return Path(__file__).parent.parent


def get_data_dir() -> Path:
    """
    Get the writable data directory for models, config, and logs.
    
    In development or truly portable mode (app dir is writable), use app dir.
    In installed mode (e.g. Program Files), use LOCALAPPDATA/MediaForge.
    """
    app_dir = get_app_dir()
    
    # Check if MEDIAFORGE_DATA_DIR is explicitly set
    data_dir_env = os.environ.get('MEDIAFORGE_DATA_DIR')
    if data_dir_env:
        return Path(data_dir_env)
    
    # Check if the app directory is writable
    test_dir = app_dir / 'models'
    try:
        test_dir.mkdir(parents=True, exist_ok=True)
        # Try creating a temp file to verify write access
        test_file = test_dir / '.write_test'
        test_file.write_text('test')
        test_file.unlink()
        return app_dir
    except (PermissionError, OSError):
        pass
    
    # Fall back to LOCALAPPDATA/MediaForge (Windows)
    if sys.platform == 'win32':
        local_app_data = os.environ.get('LOCALAPPDATA')
        if local_app_data:
            return Path(local_app_data) / 'MediaForge'
    
    # Unix fallback
    return Path.home() / '.mediaforge'


def get_models_dir() -> Path:
    """Get the models directory"""
    if os.environ.get('MEDIAFORGE_PORTABLE'):
        models_dir = get_data_dir() / 'models'
    else:
        u2net_home = os.environ.get('U2NET_HOME')
        if u2net_home:
            models_dir = Path(u2net_home)
        else:
            models_dir = get_data_dir() / 'models'
    
    models_dir.mkdir(parents=True, exist_ok=True)
    return models_dir


def get_config_dir() -> Path:
    """Get the configuration directory"""
    config_dir = get_data_dir() / 'config'
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir


def get_logs_dir() -> Path:
    """Get the logs directory"""
    logs_dir = get_data_dir() / 'logs'
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir


def setup_portable_environment():
    """Configure environment for portable mode"""
    # Set U2NET_HOME for rembg
    models_dir = get_models_dir()
    os.environ['U2NET_HOME'] = str(models_dir)
    logger.info(f"Models directory: {models_dir}")
    
    # Set ONNX Runtime cache directory
    os.environ['ORT_OPERATOR_CACHE'] = str(get_config_dir() / 'ort_cache')
    
    logger.info("Portable environment configured")


# Model URLs for download
MODEL_URLS = {
    'u2net': 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx',
    'u2netp': 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
    'u2net_human_seg': 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx',
    'isnet-general-use': 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx',
    'isnet-anime': 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx',
    'silueta': 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx',
    'RMBG-2.0': 'https://huggingface.co/briaai/RMBG-2.0/resolve/main/onnx/model.onnx',
}


def check_model(model_name: str) -> dict:
    """Check if a model is available"""
    models_dir = get_models_dir()
    model_path = models_dir / f"{model_name}.onnx"
    
    if model_path.exists():
        size_mb = model_path.stat().st_size / (1024 * 1024)
        return {
            "available": True,
            "path": str(model_path),
            "size_mb": round(size_mb, 2)
        }
    
    return {
        "available": False,
        "path": str(model_path),
        "download_url": MODEL_URLS.get(model_name),
        "message": f"Model '{model_name}' not found. Please download and place in models folder."
    }


def list_available_models() -> list:
    """List all available models"""
    models_dir = get_models_dir()
    available = []
    
    for model_name in MODEL_URLS.keys():
        model_path = models_dir / f"{model_name}.onnx"
        available.append({
            "name": model_name,
            "available": model_path.exists(),
            "download_url": MODEL_URLS[model_name]
        })
    
    return available


# Auto-setup on import
setup_portable_environment()
