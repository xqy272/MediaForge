import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Eraser,
    ImageIcon,
    RefreshCw,
    Film,
    FileVideo,
    Grid3X3,
    Github,
    PanelLeftClose,
    PanelLeftOpen,
    Cpu,
    Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getGpuInfo } from '../../lib/python-rpc';

export type ToolKey = 'background-remover' | 'image-resizer' | 'image-stitcher' | 'format-converter' | 'video-to-frames' | 'video-to-gif';

export const toolNameKeys: Record<ToolKey, string> = {
    'background-remover': 'tools.background_remover',
    'image-resizer': 'tools.image_resizer',
    'image-stitcher': 'tools.image_stitcher',
    'format-converter': 'tools.format_converter',
    'video-to-frames': 'tools.video_to_frames',
    'video-to-gif': 'tools.video_to_gif',
};

interface SidebarProps {
    activeTool: ToolKey;
    onToolChange: (tool: ToolKey) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    showSettings: boolean;
    onOpenSettings: () => void;
}

const tools: { key: ToolKey; icon: React.ElementType; nameKey: string }[] = [
    { key: 'background-remover', icon: Eraser, nameKey: 'tools.background_remover' },
    { key: 'image-resizer', icon: ImageIcon, nameKey: 'tools.image_resizer' },
    { key: 'image-stitcher', icon: Grid3X3, nameKey: 'tools.image_stitcher' },
    { key: 'format-converter', icon: RefreshCw, nameKey: 'tools.format_converter' },
    { key: 'video-to-frames', icon: Film, nameKey: 'tools.video_to_frames' },
    { key: 'video-to-gif', icon: FileVideo, nameKey: 'tools.video_to_gif' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, onToolChange, collapsed, onToggleCollapse, showSettings, onOpenSettings }) => {
    const { t } = useTranslation();
    const [gpuProvider, setGpuProvider] = useState<string | null>(null);

    useEffect(() => {
        getGpuInfo()
            .then((info) => {
                if (info.cuda_available) setGpuProvider('CUDA');
                else if (info.directml_available) setGpuProvider('DirectML');
                else setGpuProvider('CPU');
            })
            .catch(() => setGpuProvider(null));
    }, []);

    return (
        <aside className={cn(
            'h-screen bg-card border-r border-border flex flex-col transition-all duration-200',
            collapsed ? 'w-16' : 'w-60'
        )}>
            {/* Logo */}
            <div className="p-5 border-b border-border flex items-center justify-between">
                {!collapsed && (
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-primary">{t('app_name')}</h1>
                        <p className="text-xs text-muted-foreground mt-1">{t('app_subtitle')}</p>
                    </div>
                )}
                <button
                    onClick={onToggleCollapse}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                    title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                >
                    {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {tools.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = activeTool === tool.key;

                    return (
                        <motion.button
                            key={tool.key}
                            onClick={() => onToolChange(tool.key)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                                collapsed && 'justify-center px-2',
                                isActive
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            )}
                            title={collapsed ? t(tool.nameKey) : undefined}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            {!collapsed && <span>{t(tool.nameKey)}</span>}
                        </motion.button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border space-y-2">
                {/* Settings */}
                <button
                    onClick={onOpenSettings}
                    className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        collapsed && 'justify-center px-2',
                        showSettings
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                    title={collapsed ? t('settings.title') : undefined}
                >
                    <Settings className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>{t('settings.title')}</span>}
                </button>

                {/* GPU Status */}
                {gpuProvider && (
                    <div className={cn(
                        'flex items-center gap-2 text-xs text-muted-foreground',
                        collapsed && 'justify-center'
                    )}>
                        <Cpu className="w-3.5 h-3.5 shrink-0" />
                        {!collapsed && (
                            <span>{t('gpu.status')}: {gpuProvider}</span>
                        )}
                    </div>
                )}
                {!collapsed && (
                    <a
                        href="https://github.com/xqy272/MediaForge"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Github className="w-4 h-4" />
                        <span>github.com/xqy272/MediaForge</span>
                    </a>
                )}
                {collapsed && (
                    <a
                        href="https://github.com/xqy272/MediaForge"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title="GitHub"
                    >
                        <Github className="w-4 h-4" />
                    </a>
                )}
            </div>
        </aside>
    );
};
