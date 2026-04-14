import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { ImageProcessor, ImageProcessorLive } from "../src/image.ts";

// Minimal 1x1 red PNG
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

const run = <A>(effect: Effect.Effect<A, unknown, ImageProcessor>) =>
  Effect.runPromise(Effect.provide(effect, ImageProcessorLive));

describe("ImageProcessor", () => {
  it("converts PNG to WebP with correct mimeType", async () => {
    const result = await run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor;
        return yield* processor.toWebP(png, { maxBytes: 128 * 1024 });
      }),
    );
    expect(result.mimeType).toBe("image/webp");
  });

  it("output is under 128KB", async () => {
    const result = await run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor;
        return yield* processor.toWebP(png, { maxBytes: 128 * 1024 });
      }),
    );
    expect(result.compressedSize).toBeLessThanOrEqual(128 * 1024);
    expect(result.data.length).toBeLessThanOrEqual(128 * 1024);
  });

  it("reports originalSize and compressedSize", async () => {
    const result = await run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor;
        return yield* processor.toWebP(png, { maxBytes: 128 * 1024 });
      }),
    );
    expect(result.originalSize).toBe(png.length);
    expect(typeof result.compressedSize).toBe("number");
    expect(result.compressedSize).toBeGreaterThan(0);
  });

  it("reports the quality used", async () => {
    const result = await run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor;
        return yield* processor.toWebP(png, { maxBytes: 128 * 1024, initialQuality: 60 });
      }),
    );
    expect(result.quality).toBeGreaterThanOrEqual(10);
    expect(result.quality).toBeLessThanOrEqual(100);
  });
});
