declare module "hls.js" {
  export interface HlsLevel {
    height?: number;
    width?: number;
    bitrate?: number;
  }

  // Tipagem simplificada apenas para o que usamos no player.
  export default class Hls {
    static isSupported(): boolean;
    static Events: any;

    constructor(config?: any);

    loadSource(source: string): void;
    attachMedia(media: HTMLMediaElement): void;
    destroy(): void;

    on(event: any, handler: (...args: any[]) => void): void;

    currentLevel: number;
    autoLevelEnabled: boolean;
  }
}
