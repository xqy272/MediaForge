/**
 * Python RPC Client
 * Wrapper for communicating with Python backend through Tauri
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface RpcResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface ProgressEvent {
    task_id: string;
    progress: number;
    message?: string;
}

export interface LogEvent {
    level: string;
    message: string;
}

/**
 * Initialize Python backend
 */
export async function initPython(): Promise<void> {
    await invoke('init_python');
}

/**
 * Call a Python RPC method
 */
export async function pythonCall<T = unknown>(
    method: string,
    params: Record<string, unknown> = {}
): Promise<T> {
    const result = await invoke<T>('python_call', { method, params });
    return result;
}

/**
 * Check if Python is running
 */
export async function getPythonStatus(): Promise<{ running: boolean }> {
    return invoke('python_status');
}

/**
 * Stop Python backend
 */
export async function stopPython(): Promise<void> {
    await invoke('stop_python');
}

/**
 * Subscribe to progress events
 */
export function onProgress(callback: (event: ProgressEvent) => void): Promise<UnlistenFn> {
    return listen<ProgressEvent>('python-progress', (event) => {
        callback(event.payload);
    });
}

/**
 * Subscribe to log events
 */
export function onLog(callback: (event: LogEvent) => void): Promise<UnlistenFn> {
    return listen<LogEvent>('python-log', (event) => {
        callback(event.payload);
    });
}

// === Convenience wrappers for common operations ===

export interface ModelInfo {
    name: string;
    available: boolean;
    download_url?: string;
    size_mb?: number;
}

export interface ModelCheckResult {
    available: boolean;
    path: string;
    download_url?: string;
    size_mb?: number;
    message?: string;
}

export interface RemoveBackgroundResult {
    success: boolean;
    task_id?: string;
    output_path?: string;
    error?: string;
    download_url?: string;
}

export interface GpuInfo {
    available_providers: string[];
    cuda_available: boolean;
    directml_available: boolean;
    recommended_provider: string;
    error?: string;
}

/**
 * List available AI models
 */
export async function listModels(): Promise<ModelInfo[]> {
    const result = await pythonCall<{ models: ModelInfo[] }>('models.list');
    return result.models;
}

/**
 * Check if a specific model is available
 */
export async function checkModel(modelName: string): Promise<ModelCheckResult> {
    return pythonCall<ModelCheckResult>('models.check', { model_name: modelName });
}

/**
 * Get models directory path
 */
export async function getModelsDir(): Promise<string> {
    const result = await pythonCall<{ path: string }>('models.get_dir');
    return result.path;
}

/**
 * Remove background from image
 */
export async function removeBackground(
    inputPath: string,
    outputPath?: string,
    options: {
        model_name?: string;
        alpha_matting?: boolean;
        alpha_matting_foreground_threshold?: number;
        alpha_matting_background_threshold?: number;
        alpha_matting_erode_size?: number;
    } = {}
): Promise<RemoveBackgroundResult> {
    return pythonCall<RemoveBackgroundResult>('bg.remove', {
        input_path: inputPath,
        output_path: outputPath,
        ...options,
    });
}

/**
 * Remove background using chroma key
 */
export async function chromaKeyRemove(
    inputPath: string,
    outputPath?: string,
    options: {
        target_color?: [number, number, number];
        auto_detect?: boolean;
        hue_tolerance?: number;
        saturation_tolerance?: number;
        value_tolerance?: number;
    } = {}
): Promise<RemoveBackgroundResult> {
    return pythonCall<RemoveBackgroundResult>('bg.chroma_key', {
        input_path: inputPath,
        output_path: outputPath,
        ...options,
    });
}

/**
 * Resize an image
 */
export async function resizeImage(
    inputPath: string,
    mode: 'scale' | 'fixed' | 'fixed_width' | 'fixed_height',
    options: {
        output_path?: string;
        scale?: number;
        width?: number;
        height?: number;
    } = {}
): Promise<{ success: boolean; output_path?: string; error?: string }> {
    return pythonCall('image.resize', {
        input_path: inputPath,
        mode,
        ...options,
    });
}

/**
 * Get image information
 */
export async function getImageInfo(inputPath: string): Promise<{
    width: number;
    height: number;
    format: string;
    mode: string;
    size_bytes: number;
    error?: string;
}> {
    return pythonCall('image.info', { input_path: inputPath });
}

/**
 * Get video information
 */
export async function getVideoInfo(inputPath: string): Promise<{
    path: string;
    total_frames: number;
    fps: number;
    width: number;
    height: number;
    duration: number;
    error?: string;
}> {
    return pythonCall('video.info', { input_path: inputPath });
}

/**
 * Extract frames from video
 */
export async function extractFrames(
    inputPath: string,
    outputDir: string,
    options: {
        mode?: 'all' | 'interval';
        interval?: number;
        custom_resolution?: [number, number];
    } = {}
): Promise<{
    success: boolean;
    task_id?: string;
    extracted_count?: number;
    output_dir?: string;
    error?: string;
}> {
    return pythonCall('video.extract_frames', {
        input_path: inputPath,
        output_dir: outputDir,
        ...options,
    });
}

/**
 * Convert video to GIF
 */
export async function videoToGif(
    inputPath: string,
    outputPath: string,
    options: {
        fps?: number;
        scale?: number;
    } = {}
): Promise<{
    success: boolean;
    task_id?: string;
    output_path?: string;
    error?: string;
}> {
    return pythonCall('video.to_gif', {
        input_path: inputPath,
        output_path: outputPath,
        ...options,
    });
}

/**
 * Get GPU information
 */
export async function getGpuInfo(): Promise<GpuInfo> {
    return pythonCall<GpuInfo>('gpu.info');
}
