declare module "hls.js" {
  export default class Hls {
    static isSupported(): boolean;
    constructor(config?: any);
    loadSource(source: string): void;
    attachMedia(media: HTMLMediaElement): void;
    destroy(): void;
  }
}
