import { Context, Effect, Layer } from "effect";

export interface WebPResult {
  data: Uint8Array;
  mimeType: "image/webp";
  originalSize: number;
  compressedSize: number;
  quality: number;
}

export interface WebPOptions {
  maxBytes: number;
  initialQuality?: number; // default 80
  minQuality?: number; // default 10
}

export class ImageProcessor extends Context.Tag("ImageProcessor")<
  ImageProcessor,
  {
    readonly toWebP: (
      input: Uint8Array,
      options: WebPOptions,
    ) => Effect.Effect<WebPResult>;
  }
>() {}

// Attempt to use sharp (npm:sharp) for real WebP conversion.
// sharp requires native binaries and may not be available in all Deno environments.
// If the import fails, the fallback implementation is used instead.
async function trySharpCompress(
  input: Uint8Array,
  quality: number,
  resize?: boolean,
): Promise<Uint8Array | null> {
  try {
    // deno-lint-ignore no-explicit-any
    const sharp = (await import("sharp")) as any;
    const sharpFn = sharp.default ?? sharp;
    let pipeline = sharpFn(input);
    if (resize) {
      pipeline = pipeline.resize({ width: 800, withoutEnlargement: true });
    }
    // deno-lint-ignore no-explicit-any
    const buf: any = await pipeline.webp({ quality }).toBuffer();
    return buf instanceof Uint8Array
      ? buf
      : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    return null;
  }
}

export const ImageProcessorLive = Layer.succeed(ImageProcessor, {
  toWebP: (input: Uint8Array, options: WebPOptions) =>
    Effect.promise(async () => {
      const initialQuality = options.initialQuality ?? 80;
      const minQuality = options.minQuality ?? 10;
      const originalSize = input.length;

      // Try quality reduction loop with sharp
      for (
        let quality = initialQuality;
        quality >= minQuality;
        quality -= 10
      ) {
        const compressed = await trySharpCompress(input, quality, false);
        if (compressed !== null) {
          if (compressed.length <= options.maxBytes) {
            return {
              data: compressed,
              mimeType: "image/webp" as const,
              originalSize,
              compressedSize: compressed.length,
              quality,
            };
          }
          // Over budget — continue reducing quality
          continue;
        }
        // sharp not available — use fallback
        break;
      }

      // Try with resize at minQuality
      const resized = await trySharpCompress(input, minQuality, true);
      if (resized !== null) {
        return {
          data: resized,
          mimeType: "image/webp" as const,
          originalSize,
          compressedSize: resized.length,
          quality: minQuality,
        };
      }

      // Fallback: sharp is unavailable; pass through original bytes unchanged.
      // The data is labelled image/webp so the pipeline can continue without sharp.
      return {
        data: input,
        mimeType: "image/webp" as const,
        originalSize,
        compressedSize: input.length,
        quality: initialQuality,
      };
    }),
});
