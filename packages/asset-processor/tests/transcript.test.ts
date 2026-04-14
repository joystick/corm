import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { TranscriptExtractor, TranscriptExtractorLive } from "../src/transcript.ts";

const run = <A>(effect: Effect.Effect<A, unknown, TranscriptExtractor>) =>
  Effect.runPromise(Effect.provide(effect, TranscriptExtractorLive));

describe("TranscriptExtractor", () => {
  it("classifies plain text as 'plain'", async () => {
    const result = await run(
      Effect.gen(function* () {
        const extractor = yield* TranscriptExtractor;
        return yield* extractor.fromText("Hello, world!");
      }),
    );
    expect(result.format).toBe("plain");
    expect(result.text).toBe("Hello, world!");
  });

  it("classifies SSML as 'ssml'", async () => {
    const result = await run(
      Effect.gen(function* () {
        const extractor = yield* TranscriptExtractor;
        return yield* extractor.fromText("<speak>Hello <break time='1s'/> world</speak>");
      }),
    );
    expect(result.format).toBe("ssml");
  });

  it("calculates byte size correctly for ASCII", async () => {
    const text = "Hello";
    const result = await run(
      Effect.gen(function* () {
        const extractor = yield* TranscriptExtractor;
        return yield* extractor.fromText(text);
      }),
    );
    expect(result.byteSize).toBe(new TextEncoder().encode(text).length);
  });

  it("calculates byte size correctly for multibyte UTF-8", async () => {
    const text = "こんにちは"; // 5 chars, 15 bytes in UTF-8
    const result = await run(
      Effect.gen(function* () {
        const extractor = yield* TranscriptExtractor;
        return yield* extractor.fromText(text);
      }),
    );
    expect(result.byteSize).toBe(15);
  });

  it("SSML detection requires text to start with <speak", async () => {
    const result = await run(
      Effect.gen(function* () {
        const extractor = yield* TranscriptExtractor;
        return yield* extractor.fromText("Some text <speak>embedded</speak>");
      }),
    );
    // Does NOT start with <speak, so plain
    expect(result.format).toBe("plain");
  });
});
