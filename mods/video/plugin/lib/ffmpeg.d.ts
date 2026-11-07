export interface VideoMeta {
    codec?: string;
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
    has_audio: boolean;
}
export interface FrameInfo {
    time: number;
    file: string;
}
export declare class FFmpegError extends Error {
    stderr: string;
    constructor(message: string, stderr?: string);
}
export declare function makeTempDir(): string;
export declare function probeVideo(video: string, { signal }?: {
    signal?: AbortSignal;
}): Promise<VideoMeta>;
export declare function extractFrames(video: string, { interval, start, end, signal }?: {
    interval?: number;
    start?: number;
    end?: number;
    signal?: AbortSignal;
}): Promise<FrameInfo[]>;
export declare function sceneFrames(video: string, { threshold, start, end, signal }?: {
    threshold?: number;
    start?: number;
    end?: number;
    signal?: AbortSignal;
}): Promise<FrameInfo[]>;
export declare function makeGif(video: string, outPath: string, { start, end, duration, fps, width, signal }?: {
    start?: number;
    end?: number;
    duration?: number;
    fps?: number;
    width?: number;
    signal?: AbortSignal;
}): Promise<void>;
export declare function cleanupDir(dir: string | null): Promise<void>;
export declare function fmtTs(seconds: number): string;
