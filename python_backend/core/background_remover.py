"""
背景移除核心逻辑模块
基于rembg库实现图像背景移除功能

MediaForge - 媒体处理工具集
"""
import os
from typing import List, Optional, Callable, Tuple
from PIL import Image
import io


class BackgroundRemover:
    """背景移除器 - 支持 CUDA 和 DirectML GPU 加速"""
    
    # 默认模型
    DEFAULT_MODEL = 'u2net'
    
    def __init__(self, model_name: str = None):
        """
        初始化背景移除器
        
        Args:
            model_name: 模型名称，默认使用u2net
        """
        self.model_name = model_name or self.DEFAULT_MODEL
        self.session = None
        self._is_loaded = False
        self._provider_info = None
    
    def _get_providers(self) -> List[str]:
        """获取执行提供者列表"""
        try:
            from ..utils.gpu_manager import get_gpu_manager
            manager = get_gpu_manager()
            providers = manager.configure_onnxruntime_providers()
            self._provider_info = manager.get_provider_display_name()
            return providers
        except ImportError:
            self._provider_info = "CPU"
            return ['CPUExecutionProvider']
    
    def get_provider_info(self) -> str:
        """获取当前使用的执行提供者信息"""
        return self._provider_info or "Unknown"
    
    def load_model(self, 
                   progress_callback: Optional[Callable] = None,
                   log_callback: Optional[Callable] = None) -> bool:
        """
        加载模型
        
        Args:
            progress_callback: 进度回调函数
            log_callback: 日志回调函数
            
        Returns:
            bool: 是否成功
        """
        try:
            # 获取GPU执行提供者
            providers = self._get_providers()
            
            if log_callback:
                log_callback(f"Loading model: {self.model_name}")
                log_callback(f"Using: {self._provider_info}")
            
            from rembg import new_session
            
            # rembg 会自动使用最佳可用的提供者
            # 但我们可以通过环境变量影响 onnxruntime 的选择
            self.session = new_session(self.model_name)
            self._is_loaded = True
            
            if progress_callback:
                progress_callback(1.0)
            
            if log_callback:
                log_callback(f"Model {self.model_name} loaded successfully")
            
            return True
            
        except ImportError as e:
            if log_callback:
                log_callback(f"Error: rembg not installed. Run: pip install rembg")
            return False
        except Exception as e:
            if log_callback:
                log_callback(f"Error loading model: {str(e)}")
            return False
    
    def is_loaded(self) -> bool:
        """检查模型是否已加载"""
        return self._is_loaded
    
    def change_model(self, model_name: str,
                     log_callback: Optional[Callable] = None) -> bool:
        """
        切换模型
        
        Args:
            model_name: 新模型名称
            log_callback: 日志回调函数
            
        Returns:
            bool: 是否成功
        """
        self.model_name = model_name
        self.session = None
        self._is_loaded = False
        return self.load_model(log_callback=log_callback)
    
    def remove_background(self, 
                          image: Image.Image,
                          alpha_matting: bool = False,
                          alpha_matting_foreground_threshold: int = 240,
                          alpha_matting_background_threshold: int = 10,
                          alpha_matting_erode_size: int = 10) -> Image.Image:
        """
        移除图像背景
        
        Args:
            image: PIL Image对象
            alpha_matting: 是否使用alpha matting（边缘更平滑）
            alpha_matting_foreground_threshold: 前景阈值
            alpha_matting_background_threshold: 背景阈值 
            alpha_matting_erode_size: 腐蚀大小
            
        Returns:
            PIL Image: 移除背景后的图像（RGBA模式）
        """
        if not self._is_loaded:
            self.load_model()
        
        from rembg import remove
        
        result = remove(
            image,
            session=self.session,
            alpha_matting=alpha_matting,
            alpha_matting_foreground_threshold=alpha_matting_foreground_threshold,
            alpha_matting_background_threshold=alpha_matting_background_threshold,
            alpha_matting_erode_size=alpha_matting_erode_size
        )
        
        return result
    
    def remove_background_from_file(self,
                                     input_path: str,
                                     output_path: str = None,
                                     **kwargs) -> Tuple[bool, str]:
        """
        从文件移除背景
        
        Args:
            input_path: 输入图像路径
            output_path: 输出图像路径（默认在原文件名后添加_nobg）
            **kwargs: 传递给remove_background的参数
            
        Returns:
            Tuple[bool, str]: (是否成功, 输出路径或错误信息)
        """
        try:
            # 确定输出路径
            if output_path is None:
                base, ext = os.path.splitext(input_path)
                output_path = f"{base}_nobg.png"
            
            # 加载图像
            with Image.open(input_path) as img:
                # 转换为RGB如果需要
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')
                
                # 移除背景
                result = self.remove_background(img, **kwargs)
                
                # 保存结果
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
        """
        批量处理图像
        
        Args:
            input_paths: 输入图像路径列表
            output_dir: 输出目录
            progress_callback: 进度回调函数
            log_callback: 日志回调函数
            **kwargs: 传递给remove_background的参数
            
        Returns:
            Tuple[int, int]: (成功数量, 失败数量)
        """
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        success_count = 0
        fail_count = 0
        total = len(input_paths)
        
        for i, input_path in enumerate(input_paths):
            try:
                # 生成输出路径
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
            
            # 更新进度
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
        """
        处理目录中的所有图像
        
        Args:
            input_dir: 输入目录
            output_dir: 输出目录
            recursive: 是否递归处理子目录
            progress_callback: 进度回调函数
            log_callback: 日志回调函数
            **kwargs: 传递给remove_background的参数
            
        Returns:
            Tuple[int, int]: (成功数量, 失败数量)
        """
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
        """初始化色度键移除器"""
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
        """
        自动检测背景颜色（采样图像四角）
        
        Args:
            image: PIL Image对象
            sample_size: 采样区域大小（像素）
            
        Returns:
            Tuple[int, int, int]: RGB颜色值
        """
        import numpy as np
        
        # 确保图像是RGB模式
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        img_array = np.array(image)
        h, w = img_array.shape[:2]
        
        # 从四个角采样
        corners = [
            img_array[0:sample_size, 0:sample_size],  # 左上
            img_array[0:sample_size, w-sample_size:w],  # 右上
            img_array[h-sample_size:h, 0:sample_size],  # 左下
            img_array[h-sample_size:h, w-sample_size:w]  # 右下
        ]
        
        # 合并所有采样像素
        all_samples = np.concatenate([c.reshape(-1, 3) for c in corners])
        
        # 计算平均颜色
        avg_color = np.mean(all_samples, axis=0).astype(int)
        
        return tuple(avg_color)
    
    def rgb_to_hsv(self, r: int, g: int, b: int) -> Tuple[int, int, int]:
        """RGB转HSV（OpenCV格式：H 0-180, S 0-255, V 0-255）"""
        r, g, b = r / 255.0, g / 255.0, b / 255.0
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        diff = max_c - min_c
        
        # Hue
        if diff == 0:
            h = 0
        elif max_c == r:
            h = (60 * ((g - b) / diff) + 360) % 360
        elif max_c == g:
            h = (60 * ((b - r) / diff) + 120) % 360
        else:
            h = (60 * ((r - g) / diff) + 240) % 360
        
        # Saturation
        s = 0 if max_c == 0 else (diff / max_c) * 255
        
        # Value
        v = max_c * 255
        
        return (int(h / 2), int(s), int(v))  # H scaled to 0-180 for OpenCV
    
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
        """
        使用色度键移除背景
        
        Args:
            image: PIL Image对象
            target_color: 目标背景颜色 (R, G, B)，如果为None则自动检测
            hue_tolerance: 色相容差 (0-90)
            sat_threshold: 最小饱和度阈值 (0-255)
            val_threshold: 最小亮度阈值 (0-255)
            feather_radius: 边缘羽化半径（像素）
            despill_strength: 溢色抑制强度 (0-1)
            erode_size: 腐蚀大小（像素）
            dilate_size: 膨胀大小（像素）
            auto_detect: 是否自动检测背景色
            
        Returns:
            PIL Image: 移除背景后的RGBA图像
        """
        import numpy as np
        
        # 自动检测背景色
        if target_color is None and auto_detect:
            target_color = self.auto_detect_background_color(image)
        elif target_color is None:
            target_color = (0, 255, 0)  # 默认绿色
        
        # 确保图像是RGB模式
        if image.mode != 'RGB':
            rgb_image = image.convert('RGB')
        else:
            rgb_image = image
        
        img_array = np.array(rgb_image, dtype=np.float32)
        
        # 转换到HSV空间
        # 先归一化到0-1
        img_normalized = img_array / 255.0
        
        # 手动计算HSV（避免依赖cv2）
        r, g, b = img_normalized[:,:,0], img_normalized[:,:,1], img_normalized[:,:,2]
        
        max_c = np.maximum(np.maximum(r, g), b)
        min_c = np.minimum(np.minimum(r, g), b)
        diff = max_c - min_c
        
        # Value
        v = max_c
        
        # Saturation
        s = np.where(max_c == 0, 0, diff / max_c)
        
        # Hue
        h = np.zeros_like(max_c)
        mask_r = (max_c == r) & (diff != 0)
        mask_g = (max_c == g) & (diff != 0)
        mask_b = (max_c == b) & (diff != 0)
        
        h[mask_r] = (60 * ((g[mask_r] - b[mask_r]) / diff[mask_r]) + 360) % 360
        h[mask_g] = (60 * ((b[mask_g] - r[mask_g]) / diff[mask_g]) + 120) % 360
        h[mask_b] = (60 * ((r[mask_b] - g[mask_b]) / diff[mask_b]) + 240) % 360
        
        h = h / 2  # 转换为 0-180 范围
        s = s * 255
        v = v * 255
        
        # 获取目标颜色的HSV值
        target_hsv = self.rgb_to_hsv(*target_color)
        target_h, target_s, target_v = target_hsv
        
        # 创建颜色mask
        # 对于色相需要处理循环（0和180是相邻的）
        h_diff = np.abs(h - target_h)
        h_diff = np.minimum(h_diff, 180 - h_diff)
        
        # 背景mask（满足颜色条件的区域）
        bg_mask = (
            (h_diff <= hue_tolerance) &
            (s >= sat_threshold) &
            (v >= val_threshold)
        )
        
        # 前景mask（取反）
        fg_mask = ~bg_mask
        
        # 转换为float用于后续处理
        alpha = fg_mask.astype(np.float32)
        
        # 腐蚀操作
        if erode_size > 0:
            alpha = self._morphology_erode(alpha, erode_size)
        
        # 膨胀操作
        if dilate_size > 0:
            alpha = self._morphology_dilate(alpha, dilate_size)
        
        # 羽化边缘
        if feather_radius > 0:
            alpha = self._gaussian_blur(alpha, feather_radius)
        
        # 溢色抑制
        if despill_strength > 0:
            img_array = self._apply_despill(
                img_array, target_color, alpha, despill_strength
            )
        
        # 创建RGBA图像
        alpha_uint8 = (alpha * 255).astype(np.uint8)
        result = np.dstack([img_array.astype(np.uint8), alpha_uint8])
        
        return Image.fromarray(result, 'RGBA')
    
    def _morphology_erode(self, mask: 'np.ndarray', size: int) -> 'np.ndarray':
        """简单腐蚀操作"""
        import numpy as np
        from scipy.ndimage import minimum_filter
        return minimum_filter(mask, size=size * 2 + 1)
    
    def _morphology_dilate(self, mask: 'np.ndarray', size: int) -> 'np.ndarray':
        """简单膨胀操作"""
        import numpy as np
        from scipy.ndimage import maximum_filter
        return maximum_filter(mask, size=size * 2 + 1)
    
    def _gaussian_blur(self, mask: 'np.ndarray', radius: int) -> 'np.ndarray':
        """高斯模糊（用于羽化边缘）"""
        import numpy as np
        from scipy.ndimage import gaussian_filter
        return gaussian_filter(mask, sigma=radius)
    
    def _apply_despill(self, 
                       img_array: 'np.ndarray',
                       target_color: Tuple[int, int, int],
                       alpha: 'np.ndarray',
                       strength: float) -> 'np.ndarray':
        """
        溢色抑制 - 移除边缘的背景色溢出
        
        Args:
            img_array: 图像数组
            target_color: 背景颜色
            alpha: Alpha通道
            strength: 抑制强度 (0-1)
            
        Returns:
            处理后的图像数组
        """
        import numpy as np
        
        result = img_array.copy()
        
        # 只在边缘区域（alpha在0.1-0.9之间）应用溢色抑制
        edge_mask = (alpha > 0.1) & (alpha < 0.9)
        
        if not np.any(edge_mask):
            return result
        
        # 计算每个像素与背景色的相似度
        target = np.array(target_color, dtype=np.float32)
        
        # 降低与背景色相似的颜色分量
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
        """
        从文件移除背景（色度键方式）
        
        Args:
            input_path: 输入图像路径
            output_path: 输出图像路径
            **kwargs: 传递给remove_background_chroma_key的参数
            
        Returns:
            Tuple[bool, str]: (是否成功, 输出路径或错误信息)
        """
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
        """
        批量处理图像
        
        Args:
            input_paths: 输入图像路径列表
            output_dir: 输出目录
            progress_callback: 进度回调函数
            log_callback: 日志回调函数
            **kwargs: 传递给remove_background_chroma_key的参数
            
        Returns:
            Tuple[int, int]: (成功数量, 失败数量)
        """
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

