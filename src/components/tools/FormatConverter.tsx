/**
 * Format Converter Tool
 * Convert images between different formats
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import {
    Upload,
    FileType,
    Loader2,
    Check,
    AlertCircle,
    Image as ImageIcon,
    FolderOpen,
    Ban,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { pythonCall, onProgress, cancelTask, type ProgressEvent } from '../../lib/python-rpc';
import { ResultActions } from '../ui';
import { useFileDrop } from '../../hooks';

type TargetFormat = 'png' | 'jpg' | 'webp' | 'bmp';

export const FormatConverter: React.FC = () => {
    const { t } = useTranslation();

    const [inputFiles, setInputFiles] = useState<string[]>([]);
    const [outputDir, setOutputDir] = useState<string>('');
    const [targetFormat, setTargetFormat] = useState<TargetFormat>('png');
    const [quality, setQuality] = useState<number>(95);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [result, setResult] = useState<{ success: boolean; successCount?: number; failedCount?: number; outputDir?: string; error?: string } | null>(null);

    const unlistenRef = useRef<(() => void) | null>(null);
    const taskIdRef = useRef<string>('');

    // Drag-and-drop support
    const { isDragging } = useFileDrop({
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
        onDrop: (paths) => {
            setInputFiles(paths);
            setResult(null);
        },
    });

    useEffect(() => {
        return () => {
            if (unlistenRef.current) {
                unlistenRef.current();
                unlistenRef.current = null;
            }
        };
    }, []);

    const formats: { id: TargetFormat; name: string; lossy: boolean }[] = [
        { id: 'png', name: 'PNG', lossy: false },
        { id: 'jpg', name: 'JPEG', lossy: true },
        { id: 'webp', name: 'WebP', lossy: true },
        { id: 'bmp', name: 'BMP', lossy: false },
    ];

    const handleSelectFiles = useCallback(async () => {
        try {
            const files = await open({
                multiple: true,
                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }],
            });
            if (files) {
                setInputFiles(Array.isArray(files) ? files : [files]);
                setResult(null);
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
        if (inputFiles.length === 0 || !outputDir) return;

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
            const processResult = await pythonCall<{
                success: boolean;
                success_count?: number;
                failed_count?: number;
                error?: string;
            }>('image.convert_batch', {
                input_paths: inputFiles,
                output_dir: outputDir,
                target_format: targetFormat,
                quality,
                task_id: taskId,
            });

            setResult({
                success: processResult.success,
                successCount: processResult.success_count,
                failedCount: processResult.failed_count,
                outputDir: outputDir,
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
    }, [inputFiles, outputDir, targetFormat, quality]);

    const handleCancel = useCallback(async () => {
        if (taskIdRef.current) {
            await cancelTask(taskIdRef.current);
        }
    }, []);

    const selectedFormat = formats.find(f => f.id === targetFormat);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Format Selector */}
            <div className="flex flex-wrap gap-2">
                {formats.map((format) => (
                    <button
                        key={format.id}
                        onClick={() => setTargetFormat(format.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                            targetFormat === format.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        )}
                    >
                        {format.name}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('format_converter.input_images')} ({inputFiles.length})</h3>

                    {/* Drop Zone */}
                    <div
                        onClick={handleSelectFiles}
                        className={cn(
                            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                            'hover:border-primary hover:bg-primary/5',
                            isDragging && 'border-primary bg-primary/10 scale-[1.02]',
                            inputFiles.length > 0 ? 'border-primary bg-primary/5' : 'border-border'
                        )}
                    >
                        {inputFiles.length > 0 ? (
                            <div className="space-y-2">
                                <ImageIcon className="w-12 h-12 mx-auto text-primary" />
                                <p className="text-sm font-medium">{t('common.files_selected', { count: inputFiles.length })}</p>
                                <p className="text-xs text-muted-foreground">{t('common.click_to_change')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                                <p className="text-muted-foreground">{t('common.select_file')}</p>
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

                    {/* Quality (for lossy formats) */}
                    {selectedFormat?.lossy && (
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t('common.quality')}: {quality}%</label>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                value={quality}
                                onChange={(e) => setQuality(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    )}
                </div>

                {/* Output Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('common.progress')}</h3>

                    {/* Progress */}
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
                                        <p className="font-medium text-green-600">{t('common.success')}</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {t('common.converted_count', { success: result.successCount, failed: result.failedCount })}
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
                            disabled={inputFiles.length === 0 || !outputDir || isProcessing}
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
                                    <FileType className="w-5 h-5" />
                                    {t('common.convert_to', { format: targetFormat.toUpperCase() })}
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
