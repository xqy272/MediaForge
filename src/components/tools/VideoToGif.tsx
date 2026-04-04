/**
 * Video to GIF Tool
 * Convert video files to animated GIFs
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
    Upload,
    FileVideo,
    Loader2,
    Check,
    AlertCircle,
    Video,
    Ban,
} from 'lucide-react';
import { cn, getFileName } from '../../lib/utils';
import { videoToGif, getVideoInfo, onProgress, cancelTask, type ProgressEvent } from '../../lib/python-rpc';
import { ResultActions } from '../ui';
import { useFileDrop } from '../../hooks';

interface VideoInfo {
    total_frames: number;
    fps: number;
    width: number;
    height: number;
    duration: number;
}

export const VideoToGif: React.FC = () => {
    const { t } = useTranslation();

    const [inputPath, setInputPath] = useState<string>('');
    const [outputPath, setOutputPath] = useState<string>('');
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [fps, setFps] = useState<number>(10);
    const [scale, setScale] = useState<number>(100);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [result, setResult] = useState<{ success: boolean; outputPath?: string; error?: string } | null>(null);

    const unlistenRef = useRef<(() => void) | null>(null);
    const taskIdRef = useRef<string>('');

    // Drag-and-drop support
    const handleVideoReceived = useCallback(async (file: string) => {
        setInputPath(file);
        setResult(null);
        const info = await getVideoInfo(file);
        if (!info.error) {
            setVideoInfo(info);
        }
        const baseName = file.replace(/\.[^.]+$/, '');
        setOutputPath(`${baseName}.gif`);
    }, []);

    const { isDragging } = useFileDrop({
        extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv'],
        onDrop: (paths) => { if (paths.length > 0) handleVideoReceived(paths[0]); },
    });

    useEffect(() => {
        return () => {
            if (unlistenRef.current) {
                unlistenRef.current();
                unlistenRef.current = null;
            }
        };
    }, []);

    const handleSelectFile = useCallback(async () => {
        try {
            const file = await open({
                multiple: false,
                filters: [{ name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv'] }],
            });
            if (file) {
                setInputPath(file);
                setResult(null);

                const info = await getVideoInfo(file);
                if (!info.error) {
                    setVideoInfo(info);
                }

                // Auto-generate output path
                const baseName = file.replace(/\.[^.]+$/, '');
                setOutputPath(`${baseName}.gif`);
            }
        } catch (e) {
            console.error('File selection error:', e);
        }
    }, []);

    const handleSelectOutput = useCallback(async () => {
        try {
            const file = await save({
                filters: [{ name: 'GIF', extensions: ['gif'] }],
                defaultPath: outputPath || 'output.gif',
            });
            if (file) {
                setOutputPath(file);
            }
        } catch (e) {
            console.error('Save dialog error:', e);
        }
    }, [outputPath]);

    const handleProcess = useCallback(async () => {
        if (!inputPath || !outputPath) return;

        setIsProcessing(true);
        setProgress(0);
        setResult(null);

        const taskId = crypto.randomUUID();
        taskIdRef.current = taskId;

        const unlisten = await onProgress((event: ProgressEvent) => {
            setProgress(event.progress * 100);
        }, taskId);
        unlistenRef.current = unlisten;

        try {
            const processResult = await videoToGif(inputPath, outputPath, {
                fps,
                scale: scale / 100,
                task_id: taskId,
            } as Record<string, unknown>);
            setResult({ success: processResult.success, outputPath: processResult.success ? outputPath : undefined, error: processResult.error });
        } catch (e) {
            setResult({ success: false, error: String(e) });
        } finally {
            setIsProcessing(false);
            unlisten();
            unlistenRef.current = null;
            taskIdRef.current = '';
        }
    }, [inputPath, outputPath, fps, scale]);

    const handleCancel = useCallback(async () => {
        if (taskIdRef.current) {
            await cancelTask(taskIdRef.current);
        }
    }, []);

    const estimatedSize = videoInfo
        ? Math.round(videoInfo.width * (scale / 100))
        : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('video_to_gif.video_file')}</h3>

                    {/* Drop Zone */}
                    <div
                        onClick={handleSelectFile}
                        className={cn(
                            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                            'hover:border-primary hover:bg-primary/5',
                            isDragging && 'border-primary bg-primary/10 scale-[1.02]',
                            inputPath ? 'border-primary bg-primary/5' : 'border-border'
                        )}
                    >
                        {inputPath ? (
                            <div className="space-y-2">
                                <Video className="w-12 h-12 mx-auto text-primary" />
                                <p className="text-sm font-medium truncate">{getFileName(inputPath)}</p>
                                {videoInfo && (
                                    <p className="text-xs text-muted-foreground">
                                        {videoInfo.width}×{videoInfo.height} • {videoInfo.fps.toFixed(1)} fps
                                        • {(videoInfo.duration).toFixed(1)}s
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                                <p className="text-muted-foreground">{t('video_to_gif.click_to_select')}</p>
                            </div>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {t('video_to_gif.fps')}: {fps}
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="30"
                                value={fps}
                                onChange={(e) => setFps(Number(e.target.value))}
                                className="w-full"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('video_to_gif.fps_hint')}
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {t('video_to_gif.scale')}: {scale}%
                            </label>
                            <input
                                type="range"
                                min="25"
                                max="100"
                                step="25"
                                value={scale}
                                onChange={(e) => setScale(Number(e.target.value))}
                                className="w-full"
                            />
                            {videoInfo && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('video_to_gif.output_size', { size: estimatedSize })}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Output Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('common.output')}</h3>

                    {/* Output Path */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">{t('video_to_gif.gif_output')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={outputPath}
                                onChange={(e) => setOutputPath(e.target.value)}
                                placeholder="output.gif"
                                className="flex-1 bg-secondary text-foreground rounded-lg px-3 py-2 border border-border text-sm"
                            />
                            <button
                                onClick={handleSelectOutput}
                                className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-all text-sm"
                            >
                                {t('common.browse')}
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="h-3 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-primary to-primary/70"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-muted-foreground text-right">{Math.round(progress)}%</p>
                    </div>

                    {/* Result */}
                    {result && (
                        <div
                            className={cn(
                                'p-4 rounded-lg flex items-start gap-3',
                                result.success
                                    ? 'bg-green-500/10 border border-green-500/30'
                                    : 'bg-destructive/10 border border-destructive/30'
                            )}
                        >
                            {result.success ? (
                                <>
                                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                                    <div>
                                        <p className="font-medium text-green-600">{t('video_to_gif.gif_created')}</p>
                                        <ResultActions outputPath={result.outputPath} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                                    <div>
                                        <p className="font-medium text-destructive">{t('common.error')}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{result.error}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleProcess}
                            disabled={!inputPath || !outputPath || isProcessing}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
                                'bg-primary text-primary-foreground hover:bg-primary/90',
                                'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {t('common.processing')}
                                </>
                            ) : (
                                <>
                                    <FileVideo className="w-5 h-5" />
                                    {t('video_to_gif.convert_to_gif')}
                                </>
                            )}
                        </button>
                        {isProcessing && (
                            <button
                                onClick={handleCancel}
                                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                <Ban className="w-5 h-5" />
                                {t('common.cancel')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
