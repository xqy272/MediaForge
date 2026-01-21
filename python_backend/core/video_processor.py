"""
视频处理核心逻辑模块
Uses pathlib for robust Unicode path handling on Windows.
"""
import sys
import cv2
import tempfile
import uuid
from pathlib import Path
from typing import Callable, Optional, Tuple


def _log(msg: str):
    """Log message to stderr to avoid breaking JSON-RPC stdout stream."""
    sys.stderr.write(f"[VideoProcessor] {msg}\n")
    sys.stderr.flush()


class VideoProcessor:
    """视频处理器类 - 支持 Unicode 路径"""
    
    def __init__(self, video_path: str):
        """
        初始化视频处理器
        
        Args:
            video_path: 视频文件路径
        """
        self.video_path = Path(video_path)
        self._temp_path: Optional[Path] = None
        self._working_path: Path = self.video_path
        self.cap = None
        self.total_frames = 0
        self.fps = 0.0
        self.width = 0
        self.height = 0
        self._last_progress = 0
        
        # Handle paths with non-ASCII characters
        self._prepare_working_path()
        self._load_video_info()
    
    def _prepare_working_path(self):
        """
        Prepare a working path for OpenCV.
        If the original path contains non-ASCII characters and OpenCV can't open it,
        copy the file to a temporary location with an ASCII-only path.
        """
        if sys.platform != 'win32':
            self._working_path = self.video_path
            return
        
        # Check if path contains non-ASCII characters
        try:
            str(self.video_path).encode('ascii')
            # Path is ASCII-only, use directly
            self._working_path = self.video_path
            return
        except UnicodeEncodeError:
            pass
        
        # Try to open directly first (some OpenCV builds handle Unicode)
        cap = cv2.VideoCapture(str(self.video_path))
        if cap.isOpened():
            cap.release()
            self._working_path = self.video_path
            _log(f"OpenCV can open Unicode path directly")
            return
        
        # Need to copy to temp location
        _log(f"OpenCV cannot open Unicode path, creating temp copy...")
        try:
            self._temp_path = self._create_temp_copy()
            self._working_path = self._temp_path
            _log(f"Temp copy created: {self._temp_path}")
        except Exception as e:
            _log(f"Failed to create temp copy: {e}")
            # Fall back to original path (will likely fail, but at least we tried)
            self._working_path = self.video_path
    
    def _create_temp_copy(self) -> Path:
        """
        Create a temporary copy of the video file with an ASCII-only path.
        Uses pathlib which has better Unicode support than os.path.
        """
        # Get file extension
        ext = self.video_path.suffix
        
        # Create temp file path with ASCII-only name
        temp_dir = Path(tempfile.gettempdir())
        temp_name = f"mf_{uuid.uuid4().hex}{ext}"
        temp_path = temp_dir / temp_name
        
        # Copy using pathlib read/write (handles Unicode paths properly)
        _log(f"Reading from: {self.video_path}")
        data = self.video_path.read_bytes()
        _log(f"Read {len(data)} bytes, writing to: {temp_path}")
        temp_path.write_bytes(data)
        
        return temp_path
    
    def __del__(self):
        """Cleanup temporary file on destruction."""
        self._cleanup_temp()
    
    def _cleanup_temp(self):
        """Clean up temporary file if it exists."""
        if self._temp_path and self._temp_path.exists():
            try:
                self._temp_path.unlink()
                _log(f"Cleaned up temp file: {self._temp_path}")
            except Exception as e:
                _log(f"Failed to cleanup temp file: {e}")
            self._temp_path = None
    
    def _load_video_info(self):
        """加载视频信息"""
        try:
            self.cap = cv2.VideoCapture(str(self._working_path))
            if self.cap.isOpened():
                self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
                self.fps = self.cap.get(cv2.CAP_PROP_FPS)
                self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                _log(f"Video info loaded: {self.width}x{self.height}, {self.fps}fps, {self.total_frames} frames")
            else:
                _log(f"Failed to open video: {self._working_path}")
            self.cap.release()
            self.cap = None
        except Exception as e:
            _log(f"Error loading video info: {e}")
    
    def get_resolution(self) -> Tuple[int, int]:
        """获取视频分辨率"""
        return (self.width, self.height)
    
    def get_info(self) -> dict:
        """获取视频信息"""
        return {
            'path': str(self.video_path),
            'total_frames': self.total_frames,
            'fps': self.fps,
            'width': self.width,
            'height': self.height,
            'duration': self.total_frames / self.fps if self.fps > 0 else 0
        }
    
    def extract_frames(self, 
                       output_dir: str,
                       mode: str = 'all',
                       interval: int = 1,
                       custom_resolution: Optional[Tuple[int, int]] = None,
                       progress_callback: Optional[Callable] = None,
                       log_callback: Optional[Callable] = None) -> int:
        """
        从视频中提取帧
        
        Args:
            output_dir: 输出目录
            mode: 提取模式 ('all' 或 'interval')
            interval: 帧间隔（仅在interval模式下使用）
            custom_resolution: 自定义输出分辨率 (width, height)
            progress_callback: 进度回调函数，接收0-1之间的浮点数
            log_callback: 日志回调函数，接收字符串消息
            
        Returns:
            int: 提取的帧数量
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        cap = cv2.VideoCapture(str(self._working_path))
        if not cap.isOpened():
            if log_callback:
                log_callback("Error: Cannot open video file")
            return 0
        
        frame_count = 0
        extracted_count = 0
        
        # 获取视频基本名称用于输出文件命名
        base_name = self.video_path.stem
        
        if log_callback:
            log_callback(f"Total frames in video: {self.total_frames}")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            should_save = False
            if mode == 'all':
                should_save = True
            elif mode == 'interval':
                should_save = (frame_count % interval == 0)
            
            if should_save:
                # 调整分辨率
                if custom_resolution:
                    frame = cv2.resize(frame, custom_resolution, interpolation=cv2.INTER_LANCZOS4)
                
                # 保存帧
                frame_path = output_path / f"{base_name}_{extracted_count:06d}.png"
                
                # OpenCV imwrite may fail silently on Chinese paths
                # Try using the string path first
                success = cv2.imwrite(str(frame_path), frame)
                
                if not success:
                    # Fallback: use numpy to save
                    _log(f"cv2.imwrite failed for {frame_path}, trying fallback...")
                    try:
                        from PIL import Image
                        img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                        img.save(str(frame_path))
                        success = True
                    except Exception as e:
                        _log(f"Fallback save failed: {e}")
                
                if extracted_count == 0:
                    _log(f"First frame saved to: {frame_path}")
                
                extracted_count += 1
            
            frame_count += 1
            
            # 更新进度 (rate limited - update every 2%)
            if progress_callback and self.total_frames > 0:
                current_progress = frame_count / self.total_frames
                if current_progress - self._last_progress >= 0.02 or frame_count == self.total_frames:
                    try:
                        progress_callback(current_progress)
                        self._last_progress = current_progress
                    except Exception:
                        pass  # Ignore pipe errors
        
        cap.release()
        
        if log_callback:
            log_callback(f"Extraction complete. Extracted {extracted_count} frames.")
        
        return extracted_count
    
    def to_gif(self,
               output_path: str,
               fps: int = 10,
               scale: float = 1.0,
               progress_callback: Optional[Callable] = None,
               log_callback: Optional[Callable] = None) -> bool:
        """
        将视频转换为GIF
        
        Args:
            output_path: 输出GIF文件路径
            fps: 目标帧率
            scale: 缩放比例
            progress_callback: 进度回调函数
            log_callback: 日志回调函数
            
        Returns:
            bool: 是否成功
        """
        from PIL import Image
        
        cap = cv2.VideoCapture(str(self._working_path))
        if not cap.isOpened():
            if log_callback:
                log_callback("Error: Cannot open video file")
            return False
        
        frames = []
        frame_count = 0
        video_fps = cap.get(cv2.CAP_PROP_FPS)
        
        # 计算帧间隔以达到目标fps
        frame_interval = max(1, int(video_fps / fps))
        
        if log_callback:
            log_callback(f"Processing video at {video_fps} fps, target {fps} fps")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % frame_interval == 0:
                # 转换BGR到RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # 缩放
                if scale != 1.0:
                    new_size = (int(frame.shape[1] * scale), int(frame.shape[0] * scale))
                    frame_rgb = cv2.resize(frame_rgb, new_size, interpolation=cv2.INTER_LANCZOS4)
                
                pil_image = Image.fromarray(frame_rgb)
                frames.append(pil_image)
            
            frame_count += 1
            
            if progress_callback and self.total_frames > 0:
                progress_callback(frame_count / self.total_frames * 0.8)
        
        cap.release()
        
        if not frames:
            if log_callback:
                log_callback("Error: No frames captured")
            return False
        
        if log_callback:
            log_callback(f"Captured {len(frames)} frames, generating GIF...")
        
        # 保存GIF
        duration = int(1000 / fps)  # 毫秒
        gif_path = Path(output_path)
        frames[0].save(
            str(gif_path),
            save_all=True,
            append_images=frames[1:],
            duration=duration,
            loop=0,
            optimize=True
        )
        
        if progress_callback:
            progress_callback(1.0)
        
        if log_callback:
            log_callback(f"GIF saved to: {output_path}")
        
        return True
