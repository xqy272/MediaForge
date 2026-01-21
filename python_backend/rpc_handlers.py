"""
RPC Method Handlers for MediaForge
Exposes core functionality as JSON-RPC methods
"""
import os
import uuid
import logging
import threading
from pathlib import Path
from typing import List, Optional

from server import server, register_method
from utils.portable import check_model, list_available_models, get_models_dir

logger = logging.getLogger('MediaForge.RPC')

# Lazy-loaded core modules
_background_remover = None
_chroma_key_remover = None


def get_background_remover(model_name: str = 'u2net'):
    """Get or create BackgroundRemover instance"""
    global _background_remover
    from core.background_remover import BackgroundRemover
    
    if _background_remover is None or _background_remover.model_name != model_name:
        _background_remover = BackgroundRemover(model_name=model_name)
    return _background_remover


def get_chroma_key_remover():
    """Get or create ChromaKeyRemover instance"""
    global _chroma_key_remover
    from core.background_remover import ChromaKeyRemover
    
    if _chroma_key_remover is None:
        _chroma_key_remover = ChromaKeyRemover()
    return _chroma_key_remover


# === Model Management ===

@register_method("models.check")
def rpc_check_model(model_name: str, **kwargs):
    """Check if a specific model is available"""
    return check_model(model_name)


@register_method("models.list")
def rpc_list_models(**kwargs):
    """List all available models"""
    return {"models": list_available_models()}


@register_method("models.get_dir")
def rpc_get_models_dir(**kwargs):
    """Get the models directory path"""
    return {"path": str(get_models_dir())}


# === Background Removal ===

@register_method("bg.remove")
def rpc_remove_background(
    input_path: str,
    output_path: Optional[str] = None,
    model_name: str = 'u2net',
    alpha_matting: bool = False,
    alpha_matting_foreground_threshold: int = 240,
    alpha_matting_background_threshold: int = 10,
    alpha_matting_erode_size: int = 10,
    **kwargs
):
    """Remove background from a single image"""
    task_id = str(uuid.uuid4())
    
    # Check model availability
    model_status = check_model(model_name)
    if not model_status['available']:
        return {
            "success": False,
            "error": f"Model '{model_name}' not found",
            "download_url": model_status.get('download_url')
        }
    
    try:
        def log_callback(msg):
            server.send_log("INFO", msg)
        
        def progress_callback(progress):
            server.send_progress(task_id, progress)
        
        remover = get_background_remover(model_name)
        
        # Load model if not loaded
        if not remover.is_loaded():
            remover.load_model(
                progress_callback=progress_callback,
                log_callback=log_callback
            )
        
        result_path = remover.remove_background_from_file(
            input_path=input_path,
            output_path=output_path,
            alpha_matting=alpha_matting,
            alpha_matting_foreground_threshold=alpha_matting_foreground_threshold,
            alpha_matting_background_threshold=alpha_matting_background_threshold,
            alpha_matting_erode_size=alpha_matting_erode_size
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "output_path": result_path
        }
        
    except Exception as e:
        logger.error(f"Background removal failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@register_method("bg.remove_batch")
def rpc_remove_background_batch(
    input_paths: List[str],
    output_dir: str,
    model_name: str = 'u2net',
    **kwargs
):
    """Remove background from multiple images"""
    task_id = str(uuid.uuid4())
    
    # Check model availability
    model_status = check_model(model_name)
    if not model_status['available']:
        return {
            "success": False,
            "error": f"Model '{model_name}' not found",
            "download_url": model_status.get('download_url')
        }
    
    try:
        def log_callback(msg):
            server.send_log("INFO", msg)
        
        def progress_callback(progress):
            server.send_progress(task_id, progress)
        
        remover = get_background_remover(model_name)
        
        # Load model if not loaded
        if not remover.is_loaded():
            remover.load_model(
                progress_callback=progress_callback,
                log_callback=log_callback
            )
        
        results = remover.process_batch(
            input_paths=input_paths,
            output_dir=output_dir,
            progress_callback=progress_callback,
            log_callback=log_callback,
            **kwargs
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "processed_count": len(results),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Batch background removal failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@register_method("bg.chroma_key")
def rpc_chroma_key(
    input_path: str,
    output_path: Optional[str] = None,
    target_color: Optional[List[int]] = None,
    auto_detect: bool = True,
    hue_tolerance: int = 10,
    saturation_tolerance: int = 50,
    value_tolerance: int = 50,
    **kwargs
):
    """Remove background using chroma key"""
    task_id = str(uuid.uuid4())
    
    try:
        from PIL import Image
        
        remover = get_chroma_key_remover()
        image = Image.open(input_path)
        
        target = tuple(target_color) if target_color else None
        
        result = remover.remove_background_chroma_key(
            image=image,
            target_color=target,
            auto_detect=auto_detect,
            hue_tolerance=hue_tolerance,
            saturation_tolerance=saturation_tolerance,
            value_tolerance=value_tolerance,
            **kwargs
        )
        
        # Determine output path
        if output_path is None:
            name, ext = os.path.splitext(input_path)
            output_path = f"{name}_chromakey.png"
        
        result.save(output_path, 'PNG')
        
        return {
            "success": True,
            "task_id": task_id,
            "output_path": output_path
        }
        
    except Exception as e:
        logger.error(f"Chroma key removal failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


# === Image Processing ===

@register_method("image.resize")
def rpc_resize_image(
    input_path: str,
    mode: str,
    output_path: Optional[str] = None,
    scale: float = 0.5,
    width: Optional[int] = None,
    height: Optional[int] = None,
    **kwargs
):
    """Resize an image"""
    try:
        from core.image_resizer import process_image
        
        success = process_image(
            image_path=input_path,
            mode=mode,
            scale=scale,
            width=width,
            height=height,
            output_path=output_path or input_path
        )
        
        return {
            "success": success,
            "output_path": output_path or input_path
        }
        
    except Exception as e:
        logger.error(f"Image resize failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@register_method("image.info")
def rpc_image_info(input_path: str, **kwargs):
    """Get image information"""
    try:
        from core.image_resizer import get_image_info
        return get_image_info(input_path)
    except Exception as e:
        return {"error": str(e)}


# === Video Processing ===

@register_method("video.info")
def rpc_video_info(input_path: str, **kwargs):
    """Get video information"""
    try:
        from core.video_processor import VideoProcessor
        processor = VideoProcessor(input_path)
        return processor.get_info()
    except Exception as e:
        return {"error": str(e)}


@register_method("video.extract_frames")
def rpc_extract_frames(
    input_path: str,
    output_dir: str,
    mode: str = 'all',
    interval: int = 1,
    custom_resolution: Optional[List[int]] = None,
    **kwargs
):
    """Extract frames from video"""
    task_id = str(uuid.uuid4())
    
    try:
        from core.video_processor import VideoProcessor
        
        def log_callback(msg):
            server.send_log("INFO", msg)
        
        def progress_callback(progress):
            server.send_progress(task_id, progress)
        
        processor = VideoProcessor(input_path)
        
        resolution = tuple(custom_resolution) if custom_resolution else None
        
        count = processor.extract_frames(
            output_dir=output_dir,
            mode=mode,
            interval=interval,
            custom_resolution=resolution,
            progress_callback=progress_callback,
            log_callback=log_callback
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "extracted_count": count,
            "output_dir": output_dir
        }
        
    except Exception as e:
        logger.error(f"Frame extraction failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@register_method("video.to_gif")
def rpc_video_to_gif(
    input_path: str,
    output_path: str,
    fps: int = 10,
    scale: float = 1.0,
    **kwargs
):
    """Convert video to GIF"""
    task_id = str(uuid.uuid4())
    
    try:
        from core.video_processor import VideoProcessor
        
        def log_callback(msg):
            server.send_log("INFO", msg)
        
        def progress_callback(progress):
            server.send_progress(task_id, progress)
        
        processor = VideoProcessor(input_path)
        
        success = processor.to_gif(
            output_path=output_path,
            fps=fps,
            scale=scale,
            progress_callback=progress_callback,
            log_callback=log_callback
        )
        
        return {
            "success": success,
            "task_id": task_id,
            "output_path": output_path
        }
        
    except Exception as e:
        logger.error(f"Video to GIF conversion failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


# === GPU Info ===

@register_method("gpu.info")
def rpc_gpu_info(**kwargs):
    """Get GPU information"""
    try:
        import onnxruntime as ort
        
        providers = ort.get_available_providers()
        
        gpu_info = {
            "available_providers": providers,
            "cuda_available": 'CUDAExecutionProvider' in providers,
            "directml_available": 'DmlExecutionProvider' in providers,
            "recommended_provider": None
        }
        
        if 'CUDAExecutionProvider' in providers:
            gpu_info["recommended_provider"] = "CUDAExecutionProvider"
        elif 'DmlExecutionProvider' in providers:
            gpu_info["recommended_provider"] = "DmlExecutionProvider"
        else:
            gpu_info["recommended_provider"] = "CPUExecutionProvider"
        
        return gpu_info
        
    except ImportError:
        return {
            "error": "onnxruntime not installed",
            "available_providers": ["CPUExecutionProvider"],
            "cuda_available": False,
            "directml_available": False
        }
    except Exception as e:
        return {"error": str(e)}


# === Image Stitching ===

@register_method("image.stitch")
def rpc_stitch_images(
    input_paths: List[str],
    output_path: str,
    columns: int = 3,
    spacing: int = 0,
    **kwargs
):
    """Stitch multiple images into a grid"""
    task_id = str(uuid.uuid4())
    
    try:
        from PIL import Image
        
        images = []
        for i, path in enumerate(input_paths):
            img = Image.open(path)
            images.append(img)
            server.send_progress(task_id, (i + 1) / (len(input_paths) + 1))
        
        if not images:
            return {"success": False, "error": "No images loaded"}
        
        # Calculate grid dimensions
        rows = (len(images) + columns - 1) // columns
        
        # Get max dimensions
        max_w = max(img.width for img in images)
        max_h = max(img.height for img in images)
        
        # Create canvas
        canvas_w = columns * max_w + (columns - 1) * spacing
        canvas_h = rows * max_h + (rows - 1) * spacing
        
        canvas = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 0))
        
        # Paste images
        for idx, img in enumerate(images):
            row = idx // columns
            col = idx % columns
            
            x = col * (max_w + spacing) + (max_w - img.width) // 2
            y = row * (max_h + spacing) + (max_h - img.height) // 2
            
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            canvas.paste(img, (x, y))
        
        # Save
        if output_path.lower().endswith(('.jpg', '.jpeg')):
            canvas = canvas.convert('RGB')
        canvas.save(output_path)
        
        server.send_progress(task_id, 1.0)
        
        return {
            "success": True,
            "task_id": task_id,
            "output_path": output_path,
            "grid_size": f"{columns}x{rows}",
            "canvas_size": f"{canvas_w}x{canvas_h}"
        }
        
    except Exception as e:
        logger.error(f"Image stitching failed: {e}")
        return {"success": False, "error": str(e)}


# === Format Conversion ===

@register_method("image.convert")
def rpc_convert_image(
    input_path: str,
    output_path: str,
    quality: int = 95,
    **kwargs
):
    """Convert image to another format"""
    try:
        from PIL import Image
        
        img = Image.open(input_path)
        
        # Handle format specific conversions
        output_lower = output_path.lower()
        if output_lower.endswith(('.jpg', '.jpeg')):
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            img.save(output_path, 'JPEG', quality=quality)
        elif output_lower.endswith('.png'):
            img.save(output_path, 'PNG')
        elif output_lower.endswith('.webp'):
            img.save(output_path, 'WEBP', quality=quality)
        elif output_lower.endswith('.bmp'):
            if img.mode == 'RGBA':
                img = img.convert('RGB')
            img.save(output_path, 'BMP')
        else:
            img.save(output_path)
        
        return {"success": True, "output_path": output_path}
        
    except Exception as e:
        logger.error(f"Image conversion failed: {e}")
        return {"success": False, "error": str(e)}


@register_method("image.convert_batch")
def rpc_convert_batch(
    input_paths: List[str],
    output_dir: str,
    target_format: str = 'png',
    quality: int = 95,
    **kwargs
):
    """Convert multiple images to another format"""
    task_id = str(uuid.uuid4())
    
    try:
        from PIL import Image
        import os
        
        os.makedirs(output_dir, exist_ok=True)
        
        success_count = 0
        failed_count = 0
        
        for i, input_path in enumerate(input_paths):
            try:
                img = Image.open(input_path)
                
                base_name = os.path.splitext(os.path.basename(input_path))[0]
                output_path = os.path.join(output_dir, f"{base_name}.{target_format}")
                
                if target_format.lower() in ('jpg', 'jpeg'):
                    if img.mode in ('RGBA', 'LA', 'P'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img = background
                    img.save(output_path, 'JPEG', quality=quality)
                elif target_format.lower() == 'png':
                    img.save(output_path, 'PNG')
                elif target_format.lower() == 'webp':
                    img.save(output_path, 'WEBP', quality=quality)
                else:
                    img.save(output_path)
                
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to convert {input_path}: {e}")
                failed_count += 1
            
            server.send_progress(task_id, (i + 1) / len(input_paths))
        
        return {
            "success": True,
            "task_id": task_id,
            "success_count": success_count,
            "failed_count": failed_count,
            "output_dir": output_dir
        }
        
    except Exception as e:
        logger.error(f"Batch conversion failed: {e}")
        return {"success": False, "error": str(e)}


# === Image Rotation ===

@register_method("image.rotate")
def rpc_rotate_image(
    input_path: str,
    output_path: Optional[str] = None,
    angle: int = 90,
    expand: bool = True,
    **kwargs
):
    """Rotate an image by the specified angle"""
    try:
        from PIL import Image
        
        img = Image.open(input_path)
        
        rotated = img.rotate(-angle, expand=expand)  # Negative for clockwise
        
        if output_path is None:
            name, ext = os.path.splitext(input_path)
            output_path = f"{name}_rotated{ext}"
        
        rotated.save(output_path)
        
        return {
            "success": True,
            "output_path": output_path,
            "new_size": f"{rotated.width}x{rotated.height}"
        }
        
    except Exception as e:
        logger.error(f"Image rotation failed: {e}")
        return {"success": False, "error": str(e)}


# === Batch Rename ===

@register_method("image.rename_batch")
def rpc_rename_batch(
    input_paths: List[str],
    pattern: str = "image_{n}",
    start_number: int = 1,
    **kwargs
):
    """Rename multiple images with a pattern"""
    task_id = str(uuid.uuid4())
    
    try:
        import shutil
        
        results = []
        for i, input_path in enumerate(input_paths):
            try:
                dir_name = os.path.dirname(input_path)
                ext = os.path.splitext(input_path)[1]
                
                new_name = pattern.replace("{n}", str(start_number + i))
                new_name = new_name.replace("{i}", str(i))
                new_path = os.path.join(dir_name, f"{new_name}{ext}")
                
                if input_path != new_path:
                    shutil.move(input_path, new_path)
                    results.append({"old": input_path, "new": new_path})
                
            except Exception as e:
                logger.error(f"Failed to rename {input_path}: {e}")
            
            server.send_progress(task_id, (i + 1) / len(input_paths))
        
        return {
            "success": True,
            "task_id": task_id,
            "renamed_count": len(results),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Batch rename failed: {e}")
        return {"success": False, "error": str(e)}
