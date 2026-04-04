/**
 * Global Settings Page
 * Theme, language, model management, and update controls
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Sun,
    Moon,
    Monitor,
    Download,
    Check,
    FolderOpen,
    Loader2,
    RefreshCw,
    Globe,
    Palette,
    Box,
    Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../hooks/useTheme';
import {
    listModels,
    downloadModel,
    onProgress,
    type ModelInfo,
    type ProgressEvent,
} from '../../lib/python-rpc';

export const Settings: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { theme, setTheme } = useTheme();

    // Models
    const [models, setModels] = useState<(ModelInfo & { downloading?: boolean; progress?: number })[]>([]);
    const [loadingModels, setLoadingModels] = useState(true);

    // Update
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'error'>('idle');
    const [updateError, setUpdateError] = useState<string>('');
    const [updateVersion, setUpdateVersion] = useState<string>('');

    const themes = [
        { id: 'light' as const, icon: Sun, label: t('theme_light') },
        { id: 'dark' as const, icon: Moon, label: t('theme_dark') },
        { id: 'system' as const, icon: Monitor, label: t('theme_system') },
    ];

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'zh-CN', name: '简体中文' },
        { code: 'ja', name: '日本語' },
    ];

    // Load models list
    useEffect(() => {
        let mounted = true;
        setLoadingModels(true);
        listModels()
            .then((list) => {
                if (mounted) setModels(list.map((m) => ({ ...m })));
            })
            .catch(() => {})
            .finally(() => {
                if (mounted) setLoadingModels(false);
            });
        return () => { mounted = false; };
    }, []);

    const handleDownloadModel = useCallback(async (modelName: string) => {
        setModels((prev) =>
            prev.map((m) => (m.name === modelName ? { ...m, downloading: true, progress: 0 } : m))
        );

        const taskId = crypto.randomUUID();

        // Listen for progress
        const unlisten = await onProgress((event: ProgressEvent) => {
            if (event.task_id === taskId) {
                setModels((prev) =>
                    prev.map((m) =>
                        m.name === modelName ? { ...m, progress: event.progress * 100 } : m
                    )
                );
            }
        });

        try {
            const result = await downloadModel(modelName, taskId);
            if (result.success) {
                setModels((prev) =>
                    prev.map((m) =>
                        m.name === modelName
                            ? { ...m, available: true, downloading: false, progress: 100 }
                            : m
                    )
                );
            } else {
                setModels((prev) =>
                    prev.map((m) =>
                        m.name === modelName ? { ...m, downloading: false, progress: 0 } : m
                    )
                );
            }
        } catch {
            setModels((prev) =>
                prev.map((m) =>
                    m.name === modelName ? { ...m, downloading: false, progress: 0 } : m
                )
            );
        } finally {
            unlisten();
        }
    }, []);

    const handleOpenModelsDir = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_models_dir');
        } catch (e) {
            console.error('Failed to open models dir:', e);
        }
    }, []);

    const handleCheckUpdate = useCallback(async () => {
        setUpdateStatus('checking');
        setUpdateError('');
        try {
            const { check } = await import('@tauri-apps/plugin-updater');
            const update = await check();
            if (update) {
                setUpdateVersion(update.version);
                setUpdateStatus('available');
            } else {
                setUpdateStatus('up-to-date');
            }
        } catch (e) {
            setUpdateError(String(e));
            setUpdateStatus('error');
        }
    }, []);

    const handleInstallUpdate = useCallback(async () => {
        setUpdateStatus('downloading');
        try {
            const { check } = await import('@tauri-apps/plugin-updater');
            const { relaunch } = await import('@tauri-apps/plugin-process');
            const update = await check();
            if (update) {
                await update.downloadAndInstall();
                await relaunch();
            }
        } catch (e) {
            setUpdateError(String(e));
            setUpdateStatus('error');
        }
    }, []);

    const handleLanguageChange = useCallback(
        (code: string) => {
            i18n.changeLanguage(code);
            localStorage.setItem('language', code);
        },
        [i18n]
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 max-w-3xl"
        >
            {/* Appearance Section */}
            <section className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">{t('settings.appearance')}</h3>
                </div>

                {/* Theme */}
                <div>
                    <label className="text-sm font-medium mb-2 block">{t('theme')}</label>
                    <div className="flex gap-2">
                        {themes.map((th) => {
                            const Icon = th.icon;
                            return (
                                <button
                                    key={th.id}
                                    onClick={() => setTheme(th.id)}
                                    className={cn(
                                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                                        theme === th.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {th.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Language */}
                <div>
                    <label className="text-sm font-medium mb-2 block">{t('language')}</label>
                    <div className="flex gap-2">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageChange(lang.code)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                                    i18n.language === lang.code
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                )}
                            >
                                <Globe className="w-4 h-4" />
                                {lang.name}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Model Management */}
            <section className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Box className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-lg">{t('settings.models')}</h3>
                    </div>
                    <button
                        onClick={handleOpenModelsDir}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors"
                    >
                        <FolderOpen className="w-4 h-4" />
                        {t('models.open_folder')}
                    </button>
                </div>

                {loadingModels ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {models.map((model) => (
                            <div
                                key={model.name}
                                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div
                                        className={cn(
                                            'w-2.5 h-2.5 rounded-full shrink-0',
                                            model.available ? 'bg-green-500' : 'bg-muted-foreground/30'
                                        )}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">{model.name}</p>
                                        {model.available ? (
                                            <p className="text-xs text-green-600">{t('settings.model_ready')}</p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">{t('settings.model_not_downloaded')}</p>
                                        )}
                                    </div>
                                </div>

                                {model.downloading ? (
                                    <div className="flex items-center gap-2 shrink-0 w-32">
                                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-300"
                                                style={{ width: `${model.progress ?? 0}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-10 text-right">
                                            {Math.round(model.progress ?? 0)}%
                                        </span>
                                    </div>
                                ) : model.available ? (
                                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                                ) : (
                                    <button
                                        onClick={() => handleDownloadModel(model.name)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors shrink-0"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        {t('models.download')}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Auto Update */}
            <section className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">{t('settings.updates')}</h3>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">{t('settings.current_version')}: 0.1.0</p>
                        {updateStatus === 'up-to-date' && (
                            <p className="text-xs text-green-600 mt-1">{t('settings.up_to_date')}</p>
                        )}
                        {updateStatus === 'available' && (
                            <p className="text-xs text-primary mt-1">
                                {t('settings.update_available', { version: updateVersion })}
                            </p>
                        )}
                        {updateStatus === 'error' && (
                            <p className="text-xs text-destructive mt-1">{updateError}</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {updateStatus === 'available' ? (
                            <button
                                onClick={handleInstallUpdate}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                {t('settings.install_update')}
                            </button>
                        ) : (
                            <button
                                onClick={handleCheckUpdate}
                                disabled={updateStatus === 'checking'}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {updateStatus === 'checking' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                {t('settings.check_updates')}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* About */}
            <section className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">{t('settings.about')}</h3>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                    <p>MediaForge — {t('app_subtitle')}</p>
                    <p>Tauri 2.0 + React 19 + Python</p>
                    <a
                        href="https://github.com/xqy272/MediaForge"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-block"
                    >
                        github.com/xqy272/MediaForge
                    </a>
                </div>
            </section>
        </motion.div>
    );
};
