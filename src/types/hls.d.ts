declare module "hls.js" {
  export interface HlsLevel {
    height?: number;
    width?: number;
    bitrate?: number;
  }

  export interface HlsConfig {
    fragLoadingMaxRetry?: number;
    fragLoadingRetryDelay?: number;
    levelLoadingMaxRetry?: number;
    manifestLoadingMaxRetry?: number;
    [key: string]: number | boolean | string | undefined;
  }

  type HlsEventHandler = (...args: unknown[]) => void;

  // Tipagem simplificada apenas para o que usamos no player.
  export default class Hls {
    static isSupported(): boolean;
    static Events: Record<string, string>;
    static ErrorTypes: Record<string, string>;
    static ErrorDetails: Record<string, string>;

    constructor(config?: HlsConfig);

    loadSource(source: string): void;
    attachMedia(media: HTMLMediaElement): void;
    destroy(): void;
    startLoad(startPosition?: number): void;
    recoverMediaError(): void;

    on(event: string, handler: HlsEventHandler): void;

    currentLevel: number;
    autoLevelEnabled: boolean;
  }
}
