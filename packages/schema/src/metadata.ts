/**
 * CORM LOM Metadata — IEEE LOM-compatible metadata for CORM packages.
 */
import { Schema } from "effect";

export const LOMContributor = Schema.Struct({
  role: Schema.optional(Schema.String),
  entity: Schema.String,
  date: Schema.optional(Schema.String),
});

export type LOMContributor = typeof LOMContributor.Type;

export const LOMMetadata = Schema.Struct({
  title: Schema.String,
  language: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  keywords: Schema.optional(Schema.Array(Schema.String)),
  catalog: Schema.optional(Schema.String),
  entry: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  contributors: Schema.optional(Schema.Array(LOMContributor)),
  extensions: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

export type LOMMetadata = typeof LOMMetadata.Type;
