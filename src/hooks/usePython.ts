/**
 * React hook for Python backend integration
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
    initPython,
    getPythonStatus,
    onProgress,
    onLog,
    onInitProgress,
    type ProgressEvent,
    type LogEvent,
    type InitProgressEvent,
} from '../lib/python-rpc';

export interface UsePythonResult {
    isReady: boolean;
    isLoading: boolean;
    error: string | null;
    progress: ProgressEvent | null;
    initProgress: InitProgressEvent | null;
    logs: LogEvent[];
    clearLogs: () => void;
    retry: () => void;
}

export function usePython(): UsePythonResult {
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<ProgressEvent | null>(null);
    const [initProgress, setInitProgress] = useState<InitProgressEvent | null>(null);
    const [logs, setLogs] = useState<LogEvent[]>([]);
    const unlistenRefs = useRef<Array<() => void>>([]);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                setIsLoading(true);
                setError(null);
                setInitProgress(null);

                // Subscribe to init progress BEFORE calling initPython
                const unlistenInit = await onInitProgress((event) => {
                    if (mounted) {
                        setInitProgress(event);
                    }
                });
                unlistenRefs.current.push(unlistenInit);

                await initPython();

                // Clear init progress after extraction completes
                if (mounted) {
                    setInitProgress(null);
                }

                // Check if Python is running (with polling for race conditions)
                let isRunning = false;
                let attempts = 0;

                while (attempts < 30 && mounted) {
                    const status = await getPythonStatus();
                    if (status.running) {
                        isRunning = true;
                        break;
                    }
                    // Wait 500ms before retry
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }

                if (mounted) {
                    setIsReady(isRunning);
                    if (!isRunning) {
                        setError('Python backend failed to start within timeout');
                    }
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

                unlistenRefs.current.push(unlistenProgress, unlistenLog);
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
    }, [retryCount]);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    const retry = useCallback(() => {
        setRetryCount((c) => c + 1);
    }, []);

    return {
        isReady,
        isLoading,
        error,
        progress,
        initProgress,
        logs,
        clearLogs,
        retry,
    };
}
