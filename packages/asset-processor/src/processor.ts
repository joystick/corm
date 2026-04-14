import { Layer } from "effect";
import { ImageProcessorLive } from "./image.ts";
import { TranscriptExtractorLive } from "./transcript.ts";

export const AssetProcessorLive = Layer.merge(
  ImageProcessorLive,
  TranscriptExtractorLive,
);
