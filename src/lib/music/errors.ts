export class MusicError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
