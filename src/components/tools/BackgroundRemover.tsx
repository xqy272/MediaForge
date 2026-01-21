/**
 * Background Remover Tool
 * AI-powered background removal with optional chroma key mode
 */
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import {
    Upload,
    Download,
    Trash2,
    Loader2,
    Check,
    AlertCircle,
    FolderOpen,
    Image as ImageIcon,
    Sparkles,
    Palette,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
    removeBackground,
    chromaKeyRemove,
    checkModel,
    getModelsDir,
    onProgress,
    type ProgressEvent,
} from '../../lib/python-rpc';

type Mode = 'ai' | 'chromakey';

interface ProcessResult {
    success: boolean;
    outputPath?: string;
    error?: string;
}

export const BackgroundRemover: React.FC = () => {
    const { t } = useTranslation();

    // State
    const [mode, setMode] = useState<Mode>('ai');
    const [inputPath, setInputPath] = useState<string>('');
    const [outputDir, setOutputDir] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('u2net');
    const [alphaMatting, setAlphaMatting] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [result, setResult] = useState<ProcessResult | null>(null);
    const [modelStatus, setModelStatus] = useState<{ available: boolean; message?: string } | null>(null);

    // Chroma key settings
    const [autoDetect, setAutoDetect] = useState<boolean>(true);
    const [targetColor, setTargetColor] = useState<string>('#00ff00');
    const [tolerance, setTolerance] = useState<number>(30);

    const models = [
        { id: 'u2net', name: 'U2Net (General)', size: '176MB' },
        { id: 'u2netp', name: 'U2Net-P (Fast)', size: '4.7MB' },
        { id: 'isnet-general-use', name: 'ISNet (General)', size: '175MB' },
        { id: 'isnet-anime', name: 'ISNet Anime', size: '175MB' },
        { id: 'silueta', name: 'Silueta (Portrait)', size: '43MB' },
    ];

    // Select input file
    const handleSelectFile = useCallback(async () => {
        try {
            const file = await open({
                multiple: false,
                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
            });
            if (file) {
                setInputPath(file);
                setResult(null);

                // Check model availability
                if (mode === 'ai') {
                    const status = await checkModel(selectedModel);
                    setModelStatus(status);
                }
            }
        } catch (e) {
            console.error('File selection error:', e);
        }
    }, [mode, selectedModel]);

    // Select output directory
    const handleSelectOutputDir = useCallback(async () => {
        try {
            const dir = await open({
                directory: true,
            });
            if (dir) {
                setOutputDir(dir);
            }
        } catch (e) {
            console.error('Directory selection error:', e);
        }
    }, []);

    // Open models directory
    const handleOpenModelsDir = useCallback(async () => {
        try {
            const dir = await getModelsDir();
            // Use shell to open directory
            const { open: shellOpen } = await import('@tauri-apps/plugin-opener');
            await shellOpen(dir);
        } catch (e) {
            console.error('Failed to open models dir:', e);
        }
    }, []);

    // Process image
    const handleProcess = useCallback(async () => {
        if (!inputPath) return;

        setIsProcessing(true);
        setProgress(0);
        setResult(null);

        // Subscribe to progress
        const unlisten = await onProgress((event: ProgressEvent) => {
            setProgress(event.progress * 100);
        });

        try {
            let processResult: ProcessResult;

            if (mode === 'ai') {
                processResult = await removeBackground(inputPath, undefined, {
                    model_name: selectedModel,
                    alpha_matting: alphaMatting,
                });
            } else {
                // Parse hex color to RGB
                const hex = targetColor.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);

                processResult = await chromaKeyRemove(inputPath, undefined, {
                    target_color: autoDetect ? undefined : [r, g, b],
                    auto_detect: autoDetect,
                    hue_tolerance: tolerance,
                });
            }

            setResult(processResult);
        } catch (e) {
            setResult({ success: false, error: String(e) });
        } finally {
            setIsProcessing(false);
            unlisten();
        }
    }, [inputPath, mode, selectedModel, alphaMatting, autoDetect, targetColor, tolerance]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Mode Selector */}
            <div className="flex gap-2">
                <button
                    onClick={() => setMode('ai')}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                        mode === 'ai'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    )}
                >
                    <Sparkles className="w-4 h-4" />
                    AI {t('background_remover.remove_bg')}
                </button>
                <button
                    onClick={() => setMode('chromakey')}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                        mode === 'chromakey'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    )}
                >
                    <Palette className="w-4 h-4" />
                    {t('background_remover.chroma_key')}
                </button>
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
                                <p className="text-xs text-muted-foreground">{t('common.select_file')} to change</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                                <p className="text-muted-foreground">{t('background_remover.drag_drop_hint')}</p>
                            </div>
                        )}
                    </div>

                    {/* AI Mode Settings */}
                    {mode === 'ai' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">{t('background_remover.model_select')}</label>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="w-full bg-secondary text-foreground rounded-lg px-3 py-2 border border-border focus:ring-2 focus:ring-primary outline-none"
                                >
                                    {models.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.name} ({model.size})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Model Status Warning */}
                            {modelStatus && !modelStatus.available && (
                                <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-medium text-destructive">{t('models.not_found')}</p>
                                        <p className="text-muted-foreground mt-1">{t('models.download_hint')}</p>
                                        <button
                                            onClick={handleOpenModelsDir}
                                            className="text-primary hover:underline mt-2 inline-flex items-center gap-1"
                                        >
                                            <FolderOpen className="w-4 h-4" />
                                            Open models folder
                                        </button>
                                    </div>
                                </div>
                            )}

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={alphaMatting}
                                    onChange={(e) => setAlphaMatting(e.target.checked)}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <div>
                                    <span className="font-medium">{t('background_remover.alpha_matting')}</span>
                                    <p className="text-xs text-muted-foreground">{t('background_remover.alpha_matting_hint')}</p>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* Chroma Key Settings */}
                    {mode === 'chromakey' && (
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoDetect}
                                    onChange={(e) => setAutoDetect(e.target.checked)}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span className="font-medium">{t('background_remover.auto_detect')}</span>
                            </label>

                            {!autoDetect && (
                                <div>
                                    <label className="text-sm font-medium mb-2 block">{t('background_remover.target_color')}</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={targetColor}
                                            onChange={(e) => setTargetColor(e.target.value)}
                                            className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={targetColor}
                                            onChange={(e) => setTargetColor(e.target.value)}
                                            className="flex-1 bg-secondary text-foreground rounded-lg px-3 py-2 border border-border"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    {t('background_remover.tolerance')}: {tolerance}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="90"
                                    value={tolerance}
                                    onChange={(e) => setTolerance(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Output Section */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-lg">{t('common.progress')}</h3>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="h-3 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-primary to-primary/70"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.3 }}
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
                                        <p className="text-sm text-muted-foreground mt-1 break-all">{result.outputPath}</p>
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
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleProcess}
                            disabled={!inputPath || isProcessing || (mode === 'ai' && modelStatus && !modelStatus.available)}
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
                                    <Sparkles className="w-5 h-5" />
                                    {t('background_remover.remove_bg')}
                                </>
                            )}
                        </button>

                        {result?.success && (
                            <button
                                onClick={() => {
                                    setInputPath('');
                                    setResult(null);
                                    setProgress(0);
                                }}
                                className="px-4 py-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
