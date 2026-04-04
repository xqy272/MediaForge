"""
背景移除核心逻辑模块
直接使用 ONNX Runtime 加载模型，不依赖 rembg（rembg 导入时可能挂起）

MediaForge - 媒体处理工具集
"""
import os
import logging
from typing import List, Optional, Callable, Tuple
from PIL import Image

logger = logging.getLogger('MediaForge.BgRemover')

# 各模型的输入尺寸配置
MODEL_INPUT_SIZES = {
    'u2net': (320, 320),
    'u2netp': (320, 320),
    'u2net_human_seg': (320, 320),
    'silueta': (320, 320),
    'isnet-general-use': (1024, 1024),
    'isnet-anime': (1024, 1024),
    'RMBG-2.0': (1024, 1024),
}


class OnnxBgSession:
    """
    通用 ONNX 背景移除 Session
    直接使用 onnxruntime 加载模型，兼容所有 u2net / isnet / RMBG 系列
    """

    def __init__(self, model_path: str, providers: List[str], input_size: Tuple[int, int]):
        import onnxruntime as ort
        ort.set_default_logger_severity(3)
        sess_opts = ort.SessionOptions()
        sess_opts.log_severity_level = 3
        logger.info(f"Creating ONNX session: {model_path}, providers={providers}")
        self.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=providers)
        self.input_size = input_size
        logger.info("ONNX session created successfully")

    def process(self, image: Image.Image) -> Image.Image:
        """处理图片：预处理 → 推理 → 后处理 → 返回 RGBA"""
        import numpy as np

        orig_size = image.size  # (W, H)

        # 1. Preprocessing
        img_resized = image.resize(self.input_size, Image.BILINEAR)
        if img_resized.mode != 'RGB':
            img_resized = img_resized.convert('RGB')

        # ImageNet normalization
        img_np = np.array(img_resized).astype(np.float32) / 255.0
        img_np = (img_np - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]

        # NCHW format, ensure float32 (numpy upcasts to float64 during normalization)
        img_input = img_np.transpose(2, 0, 1)[np.newaxis, ...].astype(np.float32)

        # 2. Inference
        input_name = self.session.get_inputs()[0].name
        outputs = self.session.run(None, {input_name: img_input})

        # 3. Postprocessing - 取第一个输出的第一个通道作为 mask
        mask = outputs[0]
        # 处理不同的输出 shape: (1, 1, H, W) or (1, H, W) or (H, W)
        while mask.ndim > 2:
            mask = mask[0]

        # Sigmoid（某些模型输出 logits 而非概率）
        mask_min, mask_max = mask.min(), mask.max()
        if mask_min < 0 or mask_max > 1:
            # Apply sigmoid for logits
            mask = 1.0 / (1.0 + np.exp(-mask))

        # Normalize to 0-255
        mask_min, mask_max = mask.min(), mask.max()
        if mask_max - mask_min > 1e-6:
            mask = (mask - mask_min) / (mask_max - mask_min)
        mask = (mask * 255).clip(0, 255).astype(np.uint8)

        # Resize back to original
        mask_img = Image.fromarray(mask, mode='L')
        mask_img = mask_img.resize(orig_size, Image.BILINEAR)

        # Apply alpha
        result = image.convert('RGBA')
        result.putalpha(mask_img)

        return result


class BackgroundRemover:
    """背景移除器 - 支持 CUDA 和 DirectML GPU 加速"""

    DEFAULT_MODEL = 'u2net'

    def __init__(self, model_name: str = None):
        self.model_name = model_name or self.DEFAULT_MODEL
        self.session = None
        self._is_loaded = False
        self._provider_info = None

    def _get_providers(self) -> List[str]:
        """获取执行提供者列表"""
        try:
            from utils.gpu_manager import get_gpu_manager
            manager = get_gpu_manager()
            providers = manager.configure_onnxruntime_providers()
            self._provider_info = manager.get_provider_display_name()
            return providers
        except ImportError:
            self._provider_info = "CPU"
            return ['CPUExecutionProvider']

    def get_provider_info(self) -> str:
        return self._provider_info or "Unknown"

    def load_model(self,
                   progress_callback: Optional[Callable] = None,
                   log_callback: Optional[Callable] = None) -> bool:
        """加载模型"""
        try:
            providers = self._get_providers()

            if log_callback:
                log_callback(f"Loading model: {self.model_name}")
                log_callback(f"Using: {self._provider_info}")

            logger.info(f"load_model: model={self.model_name}, providers={providers}")

            # 查找模型文件
            from utils.portable import get_models_dir
            model_path = get_models_dir() / f"{self.model_name}.onnx"
            if not model_path.exists():
                raise FileNotFoundError(f"Model file not found: {model_path}")

            # 获取模型输入尺寸
            input_size = MODEL_INPUT_SIZES.get(self.model_name, (320, 320))

            logger.info(f"Loading ONNX model from {model_path}, input_size={input_size}")
            self.session = OnnxBgSession(str(model_path), providers, input_size)

            self._is_loaded = True

            if progress_callback:
                progress_callback(1.0)

            if log_callback:
                log_callback(f"Model {self.model_name} loaded successfully")

            logger.info(f"Model {self.model_name} loaded successfully")
            return True

        except Exception as e:
            logger.error(f"Error loading model: {e}", exc_info=True)
            if log_callback:
                log_callback(f"Error loading model: {str(e)}")
            return False

    def is_loaded(self) -> bool:
        return self._is_loaded

    def change_model(self, model_name: str,
                     log_callback: Optional[Callable] = None) -> bool:
        self.model_name = model_name
        self.session = None
        self._is_loaded = False
        return self.load_model(log_callback=log_callback)

    def remove_background(self,
                          image: Image.Image,
                          **kwargs) -> Image.Image:
        """移除图像背景（alpha_matting 参数保留兼容但不再使用 rembg）"""
        if not self._is_loaded:
            if not self.load_model():
                raise RuntimeError(f"Failed to load model: {self.model_name}")

        return self.session.process(image)

    def remove_background_from_file(self,
                                     input_path: str,
                                     output_path: str = None,
                                     **kwargs) -> Tuple[bool, str]:
        """从文件移除背景"""
        try:
            if output_path is None:
                base, ext = os.path.splitext(input_path)
                output_path = f"{base}_nobg.png"

            with Image.open(input_path) as img:
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')
                result = self.remove_background(img, **kwargs)
                result.save(output_path, 'PNG')

            return True, output_path

        except Exception as e:
            return False, str(e)

    def process_batch(self,
                      input_paths: List[str],
                      output_dir: str,
                      progress_callback: Optional[Callable] = None,
                      log_callback: Optional[Callable] = None,
                      **kwargs) -> Tuple[int, int]:
        """批量处理图像"""
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        success_count = 0
        fail_count = 0
        total = len(input_paths)

        for i, input_path in enumerate(input_paths):
            try:
                filename = os.path.basename(input_path)
                name, _ = os.path.splitext(filename)
                output_path = os.path.join(output_dir, f"{name}.png")

                if log_callback:
                    log_callback(f"Processing: {filename}")

                success, result = self.remove_background_from_file(
                    input_path, output_path, **kwargs
                )

                if success:
                    success_count += 1
                    if log_callback:
                        log_callback(f"Saved: {output_path}")
                else:
                    fail_count += 1
                    if log_callback:
                        log_callback(f"Failed: {filename} - {result}")

            except Exception as e:
                fail_count += 1
                if log_callback:
                    log_callback(f"Error processing {input_path}: {str(e)}")

            if progress_callback:
                progress_callback((i + 1) / total)

        return success_count, fail_count

    def process_directory(self,
                          input_dir: str,
                          output_dir: str,
                          recursive: bool = False,
                          progress_callback: Optional[Callable] = None,
                          log_callback: Optional[Callable] = None,
                          **kwargs) -> Tuple[int, int]:
        """处理目录中的所有图像"""
        valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp')
        image_paths = []

        if recursive:
            for root, _, files in os.walk(input_dir):
                for file in files:
                    if file.lower().endswith(valid_extensions):
                        image_paths.append(os.path.join(root, file))
        else:
            for file in os.listdir(input_dir):
                if file.lower().endswith(valid_extensions):
                    image_paths.append(os.path.join(input_dir, file))

        if log_callback:
            log_callback(f"Found {len(image_paths)} images to process")

        return self.process_batch(
            image_paths, output_dir,
            progress_callback, log_callback,
            **kwargs
        )


class ChromaKeyRemover:
    """色度键背景移除器 - 基于颜色的快速背景移除"""

    def __init__(self):
        self._default_settings = {
            'hue_tolerance': 10,
            'sat_threshold': 50,
            'val_threshold': 50,
            'feather_radius': 2,
            'despill_strength': 0.5,
            'erode_size': 0,
            'dilate_size': 0
        }

    def auto_detect_background_color(self, image: Image.Image,
                                      sample_size: int = 20) -> Tuple[int, int, int]:
        """自动检测背景颜色（采样图像四角）"""
        import numpy as np

        if image.mode != 'RGB':
            image = image.convert('RGB')

        img_array = np.array(image)
        h, w = img_array.shape[:2]

        corners = [
            img_array[0:sample_size, 0:sample_size],
            img_array[0:sample_size, w-sample_size:w],
            img_array[h-sample_size:h, 0:sample_size],
            img_array[h-sample_size:h, w-sample_size:w]
        ]

        all_samples = np.concatenate([c.reshape(-1, 3) for c in corners])
        avg_color = np.mean(all_samples, axis=0).astype(int)

        return tuple(avg_color)

    def rgb_to_hsv(self, r: int, g: int, b: int) -> Tuple[int, int, int]:
        """RGB转HSV（OpenCV格式：H 0-180, S 0-255, V 0-255）"""
        r, g, b = r / 255.0, g / 255.0, b / 255.0
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        diff = max_c - min_c

        if diff == 0:
            h = 0
        elif max_c == r:
            h = (60 * ((g - b) / diff) + 360) % 360
        elif max_c == g:
            h = (60 * ((b - r) / diff) + 120) % 360
        else:
            h = (60 * ((r - g) / diff) + 240) % 360

        s = 0 if max_c == 0 else (diff / max_c) * 255
        v = max_c * 255

        return (int(h / 2), int(s), int(v))

    def remove_background_chroma_key(self,
                                      image: Image.Image,
                                      target_color: Tuple[int, int, int] = None,
                                      hue_tolerance: int = 10,
                                      sat_threshold: int = 50,
                                      val_threshold: int = 50,
                                      feather_radius: int = 2,
                                      despill_strength: float = 0.5,
                                      erode_size: int = 0,
                                      dilate_size: int = 0,
                                      auto_detect: bool = True) -> Image.Image:
        """使用色度键移除背景"""
        import numpy as np

        if target_color is None and auto_detect:
            target_color = self.auto_detect_background_color(image)
        elif target_color is None:
            target_color = (0, 255, 0)

        if image.mode != 'RGB':
            rgb_image = image.convert('RGB')
        else:
            rgb_image = image

        img_array = np.array(rgb_image, dtype=np.float32)

        img_normalized = img_array / 255.0

        r, g, b = img_normalized[:,:,0], img_normalized[:,:,1], img_normalized[:,:,2]

        max_c = np.maximum(np.maximum(r, g), b)
        min_c = np.minimum(np.minimum(r, g), b)
        diff = max_c - min_c

        v = max_c
        s = np.where(max_c == 0, 0, diff / max_c)

        h = np.zeros_like(max_c)
        mask_r = (max_c == r) & (diff != 0)
        mask_g = (max_c == g) & (diff != 0)
        mask_b = (max_c == b) & (diff != 0)

        h[mask_r] = (60 * ((g[mask_r] - b[mask_r]) / diff[mask_r]) + 360) % 360
        h[mask_g] = (60 * ((b[mask_g] - r[mask_g]) / diff[mask_g]) + 120) % 360
        h[mask_b] = (60 * ((r[mask_b] - g[mask_b]) / diff[mask_b]) + 240) % 360

        h = h / 2
        s = s * 255
        v = v * 255

        target_hsv = self.rgb_to_hsv(*target_color)
        target_h, target_s, target_v = target_hsv

        h_diff = np.abs(h - target_h)
        h_diff = np.minimum(h_diff, 180 - h_diff)

        bg_mask = (
            (h_diff <= hue_tolerance) &
            (s >= sat_threshold) &
            (v >= val_threshold)
        )

        fg_mask = ~bg_mask
        alpha = fg_mask.astype(np.float32)

        if erode_size > 0:
            alpha = self._morphology_erode(alpha, erode_size)

        if dilate_size > 0:
            alpha = self._morphology_dilate(alpha, dilate_size)

        if feather_radius > 0:
            alpha = self._gaussian_blur(alpha, feather_radius)

        if despill_strength > 0:
            img_array = self._apply_despill(
                img_array, target_color, alpha, despill_strength
            )

        alpha_uint8 = (alpha * 255).astype(np.uint8)
        result = np.dstack([img_array.astype(np.uint8), alpha_uint8])

        return Image.fromarray(result, 'RGBA')

    def _morphology_erode(self, mask: 'np.ndarray', size: int) -> 'np.ndarray':
        import numpy as np
        from scipy.ndimage import minimum_filter
        return minimum_filter(mask, size=size * 2 + 1)

    def _morphology_dilate(self, mask: 'np.ndarray', size: int) -> 'np.ndarray':
        import numpy as np
        from scipy.ndimage import maximum_filter
        return maximum_filter(mask, size=size * 2 + 1)

    def _gaussian_blur(self, mask: 'np.ndarray', radius: int) -> 'np.ndarray':
        import numpy as np
        from scipy.ndimage import gaussian_filter
        return gaussian_filter(mask, sigma=radius)

    def _apply_despill(self,
                       img_array: 'np.ndarray',
                       target_color: Tuple[int, int, int],
                       alpha: 'np.ndarray',
                       strength: float) -> 'np.ndarray':
        """溢色抑制"""
        import numpy as np

        result = img_array.copy()

        edge_mask = (alpha > 0.1) & (alpha < 0.9)

        if not np.any(edge_mask):
            return result

        target = np.array(target_color, dtype=np.float32)

        for i in range(3):
            channel = result[:,:,i]
            diff = np.abs(channel - target[i])
            suppression = np.where(
                edge_mask,
                channel - (target[i] - channel) * strength * (1 - diff / 255),
                channel
            )
            result[:,:,i] = np.clip(suppression, 0, 255)

        return result

    def remove_background_from_file(self,
                                     input_path: str,
                                     output_path: str = None,
                                     **kwargs) -> Tuple[bool, str]:
        try:
            if output_path is None:
                base, ext = os.path.splitext(input_path)
                output_path = f"{base}_nobg.png"

            with Image.open(input_path) as img:
                result = self.remove_background_chroma_key(img, **kwargs)
                result.save(output_path, 'PNG')

            return True, output_path

        except Exception as e:
            return False, str(e)

    def process_batch(self,
                      input_paths: List[str],
                      output_dir: str,
                      progress_callback: Optional[Callable] = None,
                      log_callback: Optional[Callable] = None,
                      **kwargs) -> Tuple[int, int]:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        success_count = 0
        fail_count = 0
        total = len(input_paths)

        for i, input_path in enumerate(input_paths):
            try:
                filename = os.path.basename(input_path)
                name, _ = os.path.splitext(filename)
                output_path = os.path.join(output_dir, f"{name}.png")

                if log_callback:
                    log_callback(f"Processing: {filename}")

                success, result = self.remove_background_from_file(
                    input_path, output_path, **kwargs
                )

                if success:
                    success_count += 1
                    if log_callback:
                        log_callback(f"Saved: {output_path}")
                else:
                    fail_count += 1
                    if log_callback:
                        log_callback(f"Failed: {filename} - {result}")

            except Exception as e:
                fail_count += 1
                if log_callback:
                    log_callback(f"Error processing {input_path}: {str(e)}")

            if progress_callback:
                progress_callback((i + 1) / total)

        return success_count, fail_count
