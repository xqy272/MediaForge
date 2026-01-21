import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Eraser,
    ImageIcon,
    RefreshCw,
    Film,
    FileVideo,
    Grid3X3,
    Github
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToolKey = 'background-remover' | 'image-resizer' | 'image-stitcher' | 'format-converter' | 'video-to-frames' | 'video-to-gif';

interface SidebarProps {
    activeTool: ToolKey;
    onToolChange: (tool: ToolKey) => void;
}

const tools: { key: ToolKey; icon: React.ElementType; nameKey: string }[] = [
    { key: 'background-remover', icon: Eraser, nameKey: 'tools.background_remover' },
    { key: 'image-resizer', icon: ImageIcon, nameKey: 'tools.image_resizer' },
    { key: 'image-stitcher', icon: Grid3X3, nameKey: 'tools.image_stitcher' },
    { key: 'format-converter', icon: RefreshCw, nameKey: 'tools.format_converter' },
    { key: 'video-to-frames', icon: Film, nameKey: 'tools.video_to_frames' },
    { key: 'video-to-gif', icon: FileVideo, nameKey: 'tools.video_to_gif' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, onToolChange }) => {
    const { t } = useTranslation();

    return (
        <aside className="w-60 h-screen bg-card border-r border-border flex flex-col transition-theme">
            {/* Logo */}
            <div className="p-5 border-b border-border">
                <h1 className="text-xl font-bold text-primary">{t('app_name')}</h1>
                <p className="text-xs text-muted-foreground mt-1">{t('app_subtitle')}</p>
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
                                isActive
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            <span>{t(tool.nameKey)}</span>
                        </motion.button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border">
                <a
                    href="https://github.com/xqy272/MediaForge"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Github className="w-4 h-4" />
                    <span>github.com/xqy272/MediaForge</span>
                </a>
            </div>
        </aside>
    );
};
