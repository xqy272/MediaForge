import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Image as ImageIcon } from 'lucide-react';

interface ImagePreviewProps {
    filePath: string | null;
    alt?: string;
    maxHeight?: number;
    className?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
    filePath,
    alt = 'Preview',
    maxHeight = 200,
    className = '',
}) => {
    const [src, setSrc] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (filePath) {
            try {
                const url = convertFileSrc(filePath);
                setSrc(url);
                setError(false);
            } catch {
                setError(true);
                setSrc(null);
            }
        } else {
            setSrc(null);
            setError(false);
        }
    }, [filePath]);

    if (!filePath) return null;

    if (error || !src) {
        return (
            <div
                className={`flex items-center justify-center rounded-lg bg-secondary/50 p-4 ${className}`}
                style={{ maxHeight }}
            >
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className={`overflow-hidden rounded-lg bg-secondary/30 ${className}`}>
            <img
                src={src}
                alt={alt}
                className="w-full object-contain"
                style={{ maxHeight }}
                onError={() => setError(true)}
            />
        </div>
    );
};
