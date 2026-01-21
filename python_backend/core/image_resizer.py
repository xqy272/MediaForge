"""
图像缩放核心逻辑模块
"""
import os
from PIL import Image


def process_image(image_path, mode, **kwargs):
    """
    处理单个图像的缩放
    
    Args:
        image_path: 图像文件路径
        mode: 处理模式 ('scale', 'fixed', 'fixed_width', 'fixed_height')
        **kwargs: 额外参数
            - scale: 缩放比例 (mode='scale')
            - width: 目标宽度 (mode='fixed' 或 'fixed_width')
            - height: 目标高度 (mode='fixed' 或 'fixed_height')
            - output_path: 输出路径（可选，默认覆盖原图）
            
    Returns:
        bool: 处理是否成功
    """
    try:
        with Image.open(image_path) as img:
            original_size = img.size
            
            if mode == "scale":
                scale = float(kwargs.get('scale', 0.5))
                new_size = (int(img.width * scale), int(img.height * scale))
            elif mode == "fixed":
                width = int(kwargs.get('width'))
                height = int(kwargs.get('height'))
                new_size = (width, height)
            elif mode == "fixed_width":
                width = int(kwargs.get('width'))
                ratio = width / img.width
                height = int(img.height * ratio)
                new_size = (width, height)
            elif mode == "fixed_height":
                height = int(kwargs.get('height'))
                ratio = height / img.height
                width = int(img.width * ratio)
                new_size = (width, height)
            else:
                print(f"未知的处理模式: {mode} for {image_path}")
                return False

            # 使用LANCZOS算法进行高质量缩放
            resized_img = img.resize(new_size, Image.LANCZOS)

            # 确定输出路径
            output_path = kwargs.get('output_path', image_path)
            
            # 获取文件扩展名和保存格式
            file_extension = os.path.splitext(output_path)[1].lower()
            save_format = None
            
            if file_extension in ('.jpg', '.jpeg'):
                save_format = 'JPEG'
                if resized_img.mode == 'RGBA':
                    resized_img = resized_img.convert('RGB')
            elif file_extension == '.png':
                save_format = 'PNG'
            elif file_extension == '.bmp':
                save_format = 'BMP'
            elif file_extension == '.gif':
                save_format = 'GIF'
            elif file_extension == '.webp':
                save_format = 'WEBP'

            if save_format:
                if save_format == 'JPEG':
                    resized_img.save(output_path, format=save_format, quality=95)
                else:
                    resized_img.save(output_path, format=save_format)
                print(f"已处理 ({mode}): {image_path} -> {output_path}")
                return True
            else:
                print(f"不支持的保存格式: {file_extension} for {image_path}")
                return False

    except Exception as e:
        print(f"处理失败 {image_path}: {str(e)}")
        return False


def process_directory(root_dir, mode='scale', **kwargs):
    """
    批量处理目录中的图像
    
    Args:
        root_dir: 根目录路径
        mode: 处理模式
        **kwargs: 传递给process_image的参数
        
    Returns:
        int: 成功处理的图像数量
    """
    valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp')
    processed_count = 0

    for root, _, files in os.walk(root_dir):
        for file in files:
            if file.lower().endswith(valid_extensions):
                file_path = os.path.join(root, file)
                if process_image(file_path, mode, **kwargs):
                    processed_count += 1

    return processed_count


def get_image_info(image_path):
    """
    获取图像信息
    
    Args:
        image_path: 图像文件路径
        
    Returns:
        dict: 包含宽度、高度、格式等信息的字典
    """
    try:
        with Image.open(image_path) as img:
            return {
                'width': img.width,
                'height': img.height,
                'format': img.format,
                'mode': img.mode,
                'size_bytes': os.path.getsize(image_path)
            }
    except Exception as e:
        return {'error': str(e)}
