/**
 * Hook for Tauri native drag-and-drop file support.
 * Uses the webview-level onDragDropEvent API so dropped files
 * arrive with their real filesystem paths.
 */
import { useEffect, useState, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

export interface UseFileDropOptions {
    /** Allowed lowercase file extensions (without dot). If empty/undefined, all files accepted. */
    extensions?: string[];
    /** Called when files matching the filter are dropped on the window. */
    onDrop?: (paths: string[]) => void;
    /** When true the listener is not registered. */
    disabled?: boolean;
}

export function useFileDrop(options: UseFileDropOptions = {}) {
    const { extensions, onDrop, disabled = false } = options;
    const [isDragging, setIsDragging] = useState(false);

    // Keep the latest callback in a ref so the listener closure never goes stale.
    const onDropRef = useRef(onDrop);
    onDropRef.current = onDrop;

    const extensionsRef = useRef(extensions);
    extensionsRef.current = extensions;

    useEffect(() => {
        if (disabled) return;

        let unlisten: (() => void) | undefined;

        getCurrentWebviewWindow()
            .onDragDropEvent((event) => {
                const type = event.payload.type;

                if (type === 'enter' || type === 'over') {
                    setIsDragging(true);
                } else if (type === 'leave') {
                    setIsDragging(false);
                } else if (type === 'drop') {
                    setIsDragging(false);

                    let paths: string[] = event.payload.paths ?? [];

                    // Filter by extension when a whitelist is supplied
                    const exts = extensionsRef.current;
                    if (exts && exts.length > 0) {
                        paths = paths.filter((p) => {
                            const ext = p.split('.').pop()?.toLowerCase();
                            return ext != null && exts.includes(ext);
                        });
                    }

                    if (paths.length > 0 && onDropRef.current) {
                        onDropRef.current(paths);
                    }
                }
            })
            .then((fn) => {
                unlisten = fn;
            });

        return () => {
            unlisten?.();
        };
    }, [disabled]);

    return { isDragging };
}
