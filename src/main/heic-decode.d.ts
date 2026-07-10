declare module 'heic-decode' {
  export interface HeicImage {
    width: number
    height: number
    /** Decoded RGBA pixels. */
    data: ArrayBufferLike
  }
  export default function decode(input: { buffer: Buffer | Uint8Array }): Promise<HeicImage>
}
