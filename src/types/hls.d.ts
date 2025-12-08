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
    [key: string]: any;
  }

  // Tipagem simplificada apenas para o que usamos no player.
  export default class Hls {
    static isSupported(): boolean;
    static Events: {
      MANIFEST_PARSED: string;
      LEVEL_SWITCHED: string;
      ERROR: string;
      FRAG_BUFFERED: string;
      BUFFER_APPENDED: string;
      [key: string]: string;
    };
    static ErrorTypes: {
      NETWORK_ERROR: string;
      MEDIA_ERROR: string;
      KEY_SYSTEM_ERROR: string;
      MUX_ERROR: string;
      OTHER_ERROR: string;
      [key: string]: string;
    };
    static ErrorDetails: {
      FRAG_LOAD_ERROR: string;
      FRAG_LOAD_TIMEOUT: string;
      MANIFEST_LOAD_ERROR: string;
      MANIFEST_LOAD_TIMEOUT: string;
      LEVEL_LOAD_ERROR: string;
      LEVEL_LOAD_TIMEOUT: string;
      [key: string]: string;
    };

    constructor(config?: HlsConfig);

    loadSource(source: string): void;
    attachMedia(media: HTMLMediaElement): void;
    destroy(): void;
    startLoad(startPosition?: number): void;
    recoverMediaError(): void;

    on(event: any, handler: (...args: any[]) => void): void;

    currentLevel: number;
    autoLevelEnabled: boolean;
  }
}
