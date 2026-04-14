/**
 * CORM Slide Types — individual slide definitions within a module.
 */
import { Schema } from "effect";
import { AssetRef } from "./asset.ts";

export const Slide = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  layout: Schema.optional(Schema.String),
  transcript: Schema.optional(Schema.String),
  assets: Schema.optionalWith(Schema.Array(AssetRef), { default: () => [] }),
  durationEstimate: Schema.optional(Schema.Number),
  body: Schema.String,
});

export type Slide = typeof Slide.Type;
