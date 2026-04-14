/**
 * CORM Checksums — integrity manifest for package files.
 */
import { Schema } from "effect";

export const Checksums = Schema.Struct({
  version: Schema.String,
  previousVersion: Schema.optional(Schema.String),
  files: Schema.Record({ key: Schema.String, value: Schema.String }),
});

export type Checksums = typeof Checksums.Type;
