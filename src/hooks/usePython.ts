/**
 * React hook for Python backend integration
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
    initPython,
    getPythonStatus,
    onProgress,
    onLog,
    type ProgressEvent,
    type LogEvent,
} from '../lib/python-rpc';

export interface UsePythonResult {
    isReady: boolean;
    isLoading: boolean;
    error: string | null;
    progress: ProgressEvent | null;
    logs: LogEvent[];
    clearLogs: () => void;
}

export function usePython(): UsePythonResult {
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<ProgressEvent | null>(null);
    const [logs, setLogs] = useState<LogEvent[]>([]);
    const unlistenRefs = useRef<Array<() => void>>([]);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                setIsLoading(true);
                await initPython();

                // Check if Python is running
                const status = await getPythonStatus();
                if (mounted) {
                    setIsReady(status.running);
                    setError(null);
                }

                // Subscribe to events
                const unlistenProgress = await onProgress((event) => {
                    if (mounted) {
                        setProgress(event);
                    }
                });

                const unlistenLog = await onLog((event) => {
                    if (mounted) {
                        setLogs((prev) => [...prev.slice(-99), event]); // Keep last 100 logs
                    }
                });

                unlistenRefs.current = [unlistenProgress, unlistenLog];
            } catch (e) {
                if (mounted) {
                    setError(e instanceof Error ? e.message : String(e));
                    setIsReady(false);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        init();

        return () => {
            mounted = false;
            unlistenRefs.current.forEach((unlisten) => unlisten());
        };
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    return {
        isReady,
        isLoading,
        error,
        progress,
        logs,
        clearLogs,
    };
}
