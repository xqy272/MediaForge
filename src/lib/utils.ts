import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Extract filename from a file path (cross-platform compatible)
 */
export function getFileName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() || filePath;
}
