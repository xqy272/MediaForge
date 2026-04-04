/**
 * Video to Frames Tool
 * Extract frames from video files
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import {
    Upload,
    Film,
    Loader2,
    Check,
    AlertCircle,
    Video,
    FolderOpen,
    Ban,
} from 'lucide-react';
import { cn, getFileName } from '../../lib/utils';
import { extractFrames, getVideoInfo, onProgress, cancelTask, type ProgressEvent } from '../../lib/python-rpc';
import { ResultActions } from '../ui';
import { useFileDrop } from '../../hooks';

type ExtractMode = 'all' | 'interval';

interface VideoInfo {
    total_frames: number;
    fps: number;
    width: number;
    height: number;
    duration: number;
}

export const VideoToFrames: React.FC = () => {
    const { t } = useTranslation();

    const [inputPath, setInputPath] = useState<string>('');
    const [outputDir, setOutputDir] = useState<string>('');
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [mode, setMode] = useState<ExtractMode>('all');
    const [interval, setInterval] = useState<number>(10);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [result, setResult] = useState<{ success: boolean; count?: number; outputDir?: string; error?: string } | null>(null);

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
            }
        } catch (e) {
            console.error('File selection error:', e);
        }
    }, []);

    const handleSelectOutputDir = useCallback(async () => {
        try {
            const dir = await open({ directory: true });
            if (dir) {
                setOutputDir(dir);
            }
        } catch (e) {
            console.error('Directory selection error:', e);
        }
    }, []);

    const handleProcess = useCallback(async () => {
        if (!inputPath || !outputDir) return;

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
            const processResult = await extractFrames(inputPath, outputDir, {
                mode,
                interval: mode === 'interval' ? interval : 1,
                task_id: taskId,
            } as Record<string, unknown>);
            setResult({
                success: processResult.success,
                count: processResult.extracted_count,
                outputDir: processResult.success ? outputDir : undefined,
                error: processResult.error,
            });
        } catch (e) {
            setResult({ success: false, error: String(e) });
        } finally {
            setIsProcessing(false);
            unlisten();
            unlistenRef.current = null;
            taskIdRef.current = '';
        }
    }, [inputPath, outputDir, mode, interval]);

    const handleCancel = useCallback(async () => {
        if (taskIdRef.current) {
            await cancelTask(taskIdRef.current);
        }
    }, []);

    const estimatedFrames = videoInfo
        ? mode === 'all'
            ? videoInfo.total_frames
            : Math.floor(videoInfo.total_frames / interval)
        : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Mode Selector */}
            <div className="flex gap-2">
                <button
                    onClick={() => setMode('all')}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                        mode === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    )}
                >
                    {t('video_to_frames.all_frames')}
                </button>
                <button
                    onClick={() => setMode('interval')}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                        mode === 'interval'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    )}
                >
                    {t('video_to_frames.every_n_frames')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('video_to_frames.video_file')}</h3>

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
                                        • {videoInfo.total_frames} frames
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                                <p className="text-muted-foreground">{t('video_to_frames.click_to_select')}</p>
                            </div>
                        )}
                    </div>

                    {/* Output Directory */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">{t('common.output_folder')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={outputDir}
                                readOnly
                                placeholder={t('common.select_output_folder')}
                                className="flex-1 bg-secondary text-foreground rounded-lg px-3 py-2 border border-border"
                            />
                            <button
                                onClick={handleSelectOutputDir}
                                className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-all"
                            >
                                <FolderOpen className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Interval Setting */}
                    {mode === 'interval' && (
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {t('video_to_frames.extract_every', { n: interval })}
                            </label>
                            <input
                                type="range"
                                min="2"
                                max="60"
                                value={interval}
                                onChange={(e) => setInterval(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    )}
                </div>

                {/* Output Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('common.progress')}</h3>

                    {videoInfo && (
                        <div className="p-4 bg-secondary/50 rounded-lg">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('video_to_frames.estimated_frames')}:</span>
                                <span className="font-medium text-primary">~{estimatedFrames}</span>
                            </div>
                        </div>
                    )}

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
                                        <p className="font-medium text-green-600">
                                            {t('video_to_frames.extracted_count', { count: result.count })}
                                        </p>
                                        <ResultActions outputDir={result.outputDir} />
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
                    <div className="flex gap-3">
                        <button
                            onClick={handleProcess}
                            disabled={!inputPath || !outputDir || isProcessing}
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
                                    <Film className="w-5 h-5" />
                                    {t('video_to_frames.extract_frames')}
                                </>
                            )}
                        </button>
                        {isProcessing && (
                            <button
                                onClick={handleCancel}
                                className="px-4 py-3 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all"
                                title={t('common.cancel')}
                            >
                                <Ban className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
