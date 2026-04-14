import { Context, Effect, Layer } from "effect";

export interface Transcript {
  text: string;
  format: "plain" | "ssml";
  byteSize: number;
}

export class TranscriptExtractor extends Context.Tag("TranscriptExtractor")<
  TranscriptExtractor,
  {
    readonly fromText: (text: string) => Effect.Effect<Transcript>;
  }
>() {}

export const TranscriptExtractorLive = Layer.succeed(TranscriptExtractor, {
  fromText: (text: string) =>
    Effect.sync(() => {
      const format: "plain" | "ssml" = text.startsWith("<speak")
        ? "ssml"
        : "plain";
      const byteSize = new TextEncoder().encode(text).length;
      return { text, format, byteSize };
    }),
});
