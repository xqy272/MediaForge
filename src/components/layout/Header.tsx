import React from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSelector } from './LanguageSelector';
import { type ToolKey, toolNameKeys } from './Sidebar';

interface HeaderProps {
    currentTool: ToolKey;
    showSettings?: boolean;
}

const toolDescKeys: Record<ToolKey, string> = {
    'background-remover': 'tools.background_remover_desc',
    'image-resizer': 'tools.image_resizer_desc',
    'image-stitcher': 'tools.image_stitcher_desc',
    'format-converter': 'tools.format_converter_desc',
    'video-to-frames': 'tools.video_to_frames_desc',
    'video-to-gif': 'tools.video_to_gif_desc',
};

export const Header: React.FC<HeaderProps> = ({ currentTool, showSettings }) => {
    const { t } = useTranslation();

    return (
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between transition-theme">
            <div>
                <h2 className="text-lg font-semibold text-foreground">
                    {showSettings ? t('settings.title') : t(toolNameKeys[currentTool])}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {showSettings ? t('settings.description') : t(toolDescKeys[currentTool])}
                </p>
            </div>

            <div className="flex items-center gap-4">
                <LanguageSelector />
                <ThemeToggle />
            </div>
        </header>
    );
};
