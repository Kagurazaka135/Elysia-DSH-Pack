import type { Context } from '@deepseek-ai/cordis';
export interface AnalyzeOptions {
    provider: string;
    model: string;
    prompt: string;
    mode?: 'uniform' | 'scenes';
    interval?: number;
    start?: number;
    end?: number;
    threshold?: number;
    maxFrames?: number;
    maxTokens?: number;
    signal?: AbortSignal;
}
export declare function analyzeVideo(ctx: Context, video: string, options: AnalyzeOptions): Promise<{
    frames: number[];
    text: string;
    reasoning: string;
}>;
