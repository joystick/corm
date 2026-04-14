/**
 * CORM Package — top-level package combining manifest, modules, assets, checksums.
 */
import { Schema } from "effect";
import { Manifest } from "./manifest.ts";
import { Slide } from "./slide.ts";
import { AssetEntry } from "./asset.ts";
import { Checksums } from "./checksums.ts";
import { Assessment } from "./assessment.ts";

// ---------------------------------------------------------------------------
// CormModule
// ---------------------------------------------------------------------------

export const CormModule = Schema.Struct({
  id: Schema.String,
  slides: Schema.Array(Slide),
  assessments: Schema.optionalWith(Schema.Array(Assessment), {
    default: () => [],
  }),
});

export type CormModule = typeof CormModule.Type;

// ---------------------------------------------------------------------------
// StylePackage
// ---------------------------------------------------------------------------

export const StylePackage = Schema.Struct({
  id: Schema.String,
  version: Schema.String,
  templates: Schema.Record({ key: Schema.String, value: Schema.String }),
  variables: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
});

export type StylePackage = typeof StylePackage.Type;

// ---------------------------------------------------------------------------
// CormPackage
// ---------------------------------------------------------------------------

export const CormPackage = Schema.Struct({
  manifest: Manifest,
  modules: Schema.Array(CormModule),
  styles: Schema.optional(StylePackage),
  assets: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: AssetEntry }),
    { default: () => ({}) },
  ),
  checksums: Checksums,
});

export type CormPackage = typeof CormPackage.Type;
