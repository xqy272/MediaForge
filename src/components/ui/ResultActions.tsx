import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FolderOpen, Copy, Check } from 'lucide-react';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';

interface ResultActionsProps {
    outputPath?: string;
    outputDir?: string;
    className?: string;
}

export const ResultActions: React.FC<ResultActionsProps> = ({
    outputPath,
    outputDir,
    className = '',
}) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const path = outputPath || outputDir;
    if (!path) return null;

    const handleOpenFile = async () => {
        if (outputPath) {
            try {
                await openPath(outputPath);
            } catch (e) {
                console.error('Failed to open file:', e);
            }
        }
    };

    const handleRevealInFolder = async () => {
        try {
            await revealItemInDir(path);
        } catch (e) {
            console.error('Failed to reveal in folder:', e);
        }
    };

    const handleCopyPath = async () => {
        try {
            await navigator.clipboard.writeText(path);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy path:', e);
        }
    };

    return (
        <div className={`flex flex-wrap gap-2 mt-2 ${className}`}>
            {outputPath && (
                <button
                    onClick={handleOpenFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('common.open_file')}
                </button>
            )}
            <button
                onClick={handleRevealInFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md transition-colors"
            >
                <FolderOpen className="w-3.5 h-3.5" />
                {t('common.open_in_folder')}
            </button>
            <button
                onClick={handleCopyPath}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md transition-colors"
            >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t('common.path_copied') : t('common.copy_path')}
            </button>
        </div>
    );
};
