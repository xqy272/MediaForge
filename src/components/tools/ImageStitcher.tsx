/**
 * Image Stitcher Tool
 * Combine multiple images into a grid layout
 */
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
    Upload,
    Grid3X3,
    Loader2,
    Check,
    AlertCircle,
    Image as ImageIcon,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { pythonCall, onProgress, type ProgressEvent } from '../../lib/python-rpc';

export const ImageStitcher: React.FC = () => {
    const { t } = useTranslation();

    const [images, setImages] = useState<string[]>([]);
    const [outputPath, setOutputPath] = useState<string>('');
    const [columns, setColumns] = useState<number>(3);
    const [spacing, setSpacing] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [result, setResult] = useState<{ success: boolean; error?: string; info?: string } | null>(null);

    const handleAddImages = useCallback(async () => {
        try {
            const files = await open({
                multiple: true,
                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
            });
            if (files) {
                const newFiles = Array.isArray(files) ? files : [files];
                setImages(prev => [...prev, ...newFiles.filter(f => !prev.includes(f))]);
                setResult(null);
            }
        } catch (e) {
            console.error('File selection error:', e);
        }
    }, []);

    const handleRemoveImage = useCallback((index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleClearAll = useCallback(() => {
        setImages([]);
        setResult(null);
    }, []);

    const handleSelectOutput = useCallback(async () => {
        try {
            const file = await save({
                filters: [
                    { name: 'PNG', extensions: ['png'] },
                    { name: 'JPEG', extensions: ['jpg'] },
                ],
                defaultPath: 'stitched.png',
            });
            if (file) {
                setOutputPath(file);
            }
        } catch (e) {
            console.error('Save dialog error:', e);
        }
    }, []);

    const handleProcess = useCallback(async () => {
        if (images.length < 2 || !outputPath) return;

        setIsProcessing(true);
        setProgress(0);
        setResult(null);

        const unlisten = await onProgress((event: ProgressEvent) => {
            setProgress(event.progress * 100);
        });

        try {
            const processResult = await pythonCall<{
                success: boolean;
                error?: string;
                grid_size?: string;
                canvas_size?: string;
            }>('image.stitch', {
                input_paths: images,
                output_path: outputPath,
                columns,
                spacing,
            });

            setResult({
                success: processResult.success,
                error: processResult.error,
                info: processResult.success
                    ? `Grid: ${processResult.grid_size}, Size: ${processResult.canvas_size}`
                    : undefined,
            });
        } catch (e) {
            setResult({ success: false, error: String(e) });
        } finally {
            setIsProcessing(false);
            unlisten();
        }
    }, [images, outputPath, columns, spacing]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">{t('image_stitcher.images')} ({images.length})</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={handleAddImages}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                            >
                                <Plus className="w-4 h-4" />
                                {t('common.add')}
                            </button>
                            <button
                                onClick={handleClearAll}
                                disabled={images.length === 0}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                {t('common.clear')}
                            </button>
                        </div>
                    </div>

                    {/* Image List */}
                    <div className="max-h-48 overflow-y-auto space-y-2">
                        {images.length === 0 ? (
                            <div
                                onClick={handleAddImages}
                                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                            >
                                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                                <p className="text-muted-foreground text-sm">{t('common.click_to_add_images')}</p>
                            </div>
                        ) : (
                            images.map((path, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <span className="text-sm truncate">{path.split('\\').pop()}</span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveImage(index)}
                                        className="p-1 hover:bg-destructive/20 rounded"
                                    >
                                        <X className="w-4 h-4 text-destructive" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t('common.columns')}: {columns}</label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={columns}
                                onChange={(e) => setColumns(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t('common.spacing')}: {spacing}px</label>
                            <input
                                type="range"
                                min="0"
                                max="50"
                                value={spacing}
                                onChange={(e) => setSpacing(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>

                {/* Output Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('common.output')}</h3>

                    {/* Output Path */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">{t('common.output_folder')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={outputPath}
                                readOnly
                                placeholder={t('common.select_output_file')}
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
                                        {result.info && <p className="text-sm text-muted-foreground mt-1">{result.info}</p>}
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

                    {/* Action Button */}
                    <button
                        onClick={handleProcess}
                        disabled={images.length < 2 || !outputPath || isProcessing}
                        className={cn(
                            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
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
                                <Grid3X3 className="w-5 h-5" />
                                {t('image_stitcher.stitch_images')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
