import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { ToolKey } from '../layout';

interface ToolPlaceholderProps {
    toolKey: ToolKey;
}

export const ToolPlaceholder: React.FC<ToolPlaceholderProps> = ({ toolKey }) => {
    const { t } = useTranslation();

    const toolNameKeys: Record<ToolKey, string> = {
        'background-remover': 'tools.background_remover',
        'image-resizer': 'tools.image_resizer',
        'format-converter': 'tools.format_converter',
        'video-to-frames': 'tools.video_to_frames',
        'video-to-gif': 'tools.video_to_gif',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full flex items-center justify-center"
        >
            <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <span className="text-4xl">🚧</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                    {t(toolNameKeys[toolKey])}
                </h3>
                <p className="text-muted-foreground">
                    Coming soon...
                </p>
            </div>
        </motion.div>
    );
};
