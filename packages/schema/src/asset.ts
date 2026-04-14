/**
 * CORM Asset Types — asset references and entries.
 */
import { Schema } from "effect";

/** A reference to an asset by filename or path. */
export const AssetRef = Schema.String;
export type AssetRef = typeof AssetRef.Type;

export const AssetEntry = Schema.Struct({
  hash: Schema.String,
  originalPath: Schema.optional(Schema.String),
  mimeType: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Number),
});

export type AssetEntry = typeof AssetEntry.Type;
