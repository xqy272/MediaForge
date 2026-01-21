/**
 * Image Resizer Tool
 * Resize images with multiple modes: scale, fixed, width, height
 */
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import {
    Upload,
    Maximize2,
    Loader2,
    Check,
    AlertCircle,
    Image as ImageIcon,
    ArrowRightLeft,
    ArrowUpDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { resizeImage, getImageInfo } from '../../lib/python-rpc';

type ResizeMode = 'scale' | 'fixed' | 'fixed_width' | 'fixed_height';

interface ImageInfo {
    width: number;
    height: number;
    format: string;
}

export const ImageResizer: React.FC = () => {
    const { t } = useTranslation();

    const [inputPath, setInputPath] = useState<string>('');
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [mode, setMode] = useState<ResizeMode>('scale');
    const [scale, setScale] = useState<number>(50);
    const [width, setWidth] = useState<number>(800);
    const [height, setHeight] = useState<number>(600);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

    const modes = [
        { id: 'scale' as const, icon: Maximize2, label: t('image_resizer.scale_percent') },
        { id: 'fixed' as const, icon: ArrowRightLeft, label: t('image_resizer.fixed_size') },
        { id: 'fixed_width' as const, icon: ArrowRightLeft, label: t('image_resizer.fixed_width') },
        { id: 'fixed_height' as const, icon: ArrowUpDown, label: t('image_resizer.fixed_height') },
    ];

    const handleSelectFile = useCallback(async () => {
        try {
            const file = await open({
                multiple: false,
                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }],
            });
            if (file) {
                setInputPath(file);
                setResult(null);

                // Get image info
                const info = await getImageInfo(file);
                if (!info.error) {
                    setImageInfo({ width: info.width, height: info.height, format: info.format });
                    setWidth(info.width);
                    setHeight(info.height);
                }
            }
        } catch (e) {
            console.error('File selection error:', e);
        }
    }, []);

    const getNewDimensions = useCallback((): { width: number; height: number } => {
        if (!imageInfo) return { width: 0, height: 0 };

        switch (mode) {
            case 'scale':
                return {
                    width: Math.round(imageInfo.width * scale / 100),
                    height: Math.round(imageInfo.height * scale / 100),
                };
            case 'fixed':
                return { width, height };
            case 'fixed_width':
                return {
                    width,
                    height: Math.round((width / imageInfo.width) * imageInfo.height),
                };
            case 'fixed_height':
                return {
                    width: Math.round((height / imageInfo.height) * imageInfo.width),
                    height,
                };
        }
    }, [imageInfo, mode, scale, width, height]);

    const handleProcess = useCallback(async () => {
        if (!inputPath) return;

        setIsProcessing(true);
        setResult(null);

        try {
            const processResult = await resizeImage(inputPath, mode, {
                scale: scale / 100,
                width,
                height,
            });
            setResult(processResult);
        } catch (e) {
            setResult({ success: false, error: String(e) });
        } finally {
            setIsProcessing(false);
        }
    }, [inputPath, mode, scale, width, height]);

    const newDimensions = getNewDimensions();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Mode Selector */}
            <div className="flex flex-wrap gap-2">
                {modes.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                            mode === m.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        )}
                    >
                        <m.icon className="w-4 h-4" />
                        {m.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('background_remover.input_image')}</h3>

                    {/* Drop Zone */}
                    <div
                        onClick={handleSelectFile}
                        className={cn(
                            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                            'hover:border-primary hover:bg-primary/5',
                            inputPath ? 'border-primary bg-primary/5' : 'border-border'
                        )}
                    >
                        {inputPath ? (
                            <div className="space-y-2">
                                <ImageIcon className="w-12 h-12 mx-auto text-primary" />
                                <p className="text-sm font-medium truncate">{inputPath.split('\\').pop()}</p>
                                {imageInfo && (
                                    <p className="text-xs text-muted-foreground">
                                        {imageInfo.width} × {imageInfo.height} • {imageInfo.format}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                                <p className="text-muted-foreground">{t('background_remover.drag_drop_hint')}</p>
                            </div>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="space-y-4">
                        {mode === 'scale' && (
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    {t('common.scale')}: {scale}%
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="200"
                                    value={scale}
                                    onChange={(e) => setScale(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        )}

                        {(mode === 'fixed' || mode === 'fixed_width') && (
                            <div>
                                <label className="text-sm font-medium mb-2 block">{t('common.width')} (px)</label>
                                <input
                                    type="number"
                                    value={width}
                                    onChange={(e) => setWidth(Number(e.target.value))}
                                    className="w-full bg-secondary text-foreground rounded-lg px-3 py-2 border border-border"
                                />
                            </div>
                        )}

                        {(mode === 'fixed' || mode === 'fixed_height') && (
                            <div>
                                <label className="text-sm font-medium mb-2 block">{t('common.height')} (px)</label>
                                <input
                                    type="number"
                                    value={height}
                                    onChange={(e) => setHeight(Number(e.target.value))}
                                    className="w-full bg-secondary text-foreground rounded-lg px-3 py-2 border border-border"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Output Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('image_resizer.output_preview')}</h3>

                    {imageInfo && (
                        <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('common.original')}:</span>
                                <span className="font-medium">{imageInfo.width} × {imageInfo.height}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('common.new_size')}:</span>
                                <span className="font-medium text-primary">
                                    {newDimensions.width} × {newDimensions.height}
                                </span>
                            </div>
                        </div>
                    )}

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
                                    <p className="font-medium text-green-600">{t('common.success')}</p>
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
                    <button
                        onClick={handleProcess}
                        disabled={!inputPath || isProcessing}
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
                                <Maximize2 className="w-5 h-5" />
                                {t('image_resizer.resize_image')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
