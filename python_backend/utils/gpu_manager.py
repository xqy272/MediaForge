"""
GPU Manager for MediaForge
Detects available GPU acceleration and configures ONNX Runtime providers
"""
import logging
from typing import List

logger = logging.getLogger('MediaForge.GPU')

_gpu_manager = None


class GpuManager:
    """Manages GPU provider selection for ONNX Runtime"""

    def __init__(self):
        self._providers: List[str] = []
        self._display_name: str = "CPU"
        self._detect_providers()

    def _detect_providers(self):
        """Detect available ONNX Runtime execution providers"""
        try:
            import onnxruntime as ort
            ort.set_default_logger_severity(3)  # Suppress C++ logs to stdout
            available = ort.get_available_providers()
            logger.info(f"Available ONNX Runtime providers: {available}")

            # Filter out providers that are not suitable for local inference
            # AzureExecutionProvider requires cloud credentials and can hang
            excluded = {'AzureExecutionProvider'}
            available = [p for p in available if p not in excluded]

            if 'CUDAExecutionProvider' in available:
                self._providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
                self._display_name = "CUDA GPU"
            elif 'DmlExecutionProvider' in available:
                self._providers = ['DmlExecutionProvider', 'CPUExecutionProvider']
                self._display_name = "DirectML GPU"
            else:
                self._providers = ['CPUExecutionProvider']
                self._display_name = "CPU"

        except ImportError:
            logger.warning("onnxruntime not installed, using CPU only")
            self._providers = ['CPUExecutionProvider']
            self._display_name = "CPU"
        except Exception as e:
            logger.error(f"Error detecting GPU providers: {e}")
            self._providers = ['CPUExecutionProvider']
            self._display_name = "CPU"

    def configure_onnxruntime_providers(self) -> List[str]:
        """Get the list of providers to use with ONNX Runtime"""
        return self._providers

    def get_provider_display_name(self) -> str:
        """Get a human-readable description of the current provider"""
        return self._display_name


def get_gpu_manager() -> GpuManager:
    """Get or create the singleton GpuManager instance"""
    global _gpu_manager
    if _gpu_manager is None:
        _gpu_manager = GpuManager()
    return _gpu_manager
