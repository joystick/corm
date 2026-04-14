/**
 * CORM Manifest — the top-level manifest schema for a CORM package.
 * Includes recursive Item type, Organization, and Manifest.
 */
import { Schema } from "effect";
import { ItemSequencing } from "./sequencing.ts";
import { LOMMetadata } from "./metadata.ts";

// ---------------------------------------------------------------------------
// ScormVersion
// ---------------------------------------------------------------------------

export const ScormVersion = Schema.Literal(
  "1.2",
  "2004-2nd",
  "2004-3rd",
  "2004-4th",
);

export type ScormVersion = typeof ScormVersion.Type;

// ---------------------------------------------------------------------------
// TTSConfig
// ---------------------------------------------------------------------------

export const TTSConfig = Schema.Struct({
  engine: Schema.optionalWith(Schema.String, { default: () => "browser" }),
  voice: Schema.optional(Schema.String),
  rate: Schema.optionalWith(Schema.Number, { default: () => 1.0 }),
});

export type TTSConfig = typeof TTSConfig.Type;

// ---------------------------------------------------------------------------
// HideLMSUI
// ---------------------------------------------------------------------------

export const HideLMSUI = Schema.Struct({
  previous: Schema.optional(Schema.Boolean),
  continue: Schema.optional(Schema.Boolean),
  exit: Schema.optional(Schema.Boolean),
  exitAll: Schema.optional(Schema.Boolean),
  abandon: Schema.optional(Schema.Boolean),
  abandonAll: Schema.optional(Schema.Boolean),
  suspendAll: Schema.optional(Schema.Boolean),
});

export type HideLMSUI = typeof HideLMSUI.Type;

// ---------------------------------------------------------------------------
// Item — recursive type
// ---------------------------------------------------------------------------

export interface ItemType {
  id: string;
  title: string;
  isVisible: boolean;
  parameters?: string | undefined;
  hideLmsUi?: typeof HideLMSUI.Type | undefined;
  items?: ItemType[] | undefined;
  content?: string[] | undefined;
  assessmentRef?: string | undefined;
  sequencing?: typeof ItemSequencing.Type | undefined;
}

// We use `Schema.suspend` to allow self-reference in the items field.
// The `as any` casts are needed because TypeScript cannot infer the recursive type.
export const Item: Schema.Schema<ItemType, unknown> = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  isVisible: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  parameters: Schema.optional(Schema.String),
  hideLmsUi: Schema.optional(HideLMSUI),
  items: Schema.optional(Schema.Array(Schema.suspend(() => Item))),
  content: Schema.optional(Schema.Array(Schema.String)),
  assessmentRef: Schema.optional(Schema.String),
  sequencing: Schema.optional(ItemSequencing),
}) as any;

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export const Organization = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  items: Schema.Array(Item),
  sequencing: Schema.optional(ItemSequencing),
});

export type Organization = typeof Organization.Type;

// ---------------------------------------------------------------------------
// GlobalSequencing
// ---------------------------------------------------------------------------

export const SharedObjective = Schema.Struct({
  id: Schema.String,
  globalToSystem: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});

export type SharedObjective = typeof SharedObjective.Type;

export const GlobalSequencing = Schema.Struct({
  sharedObjectives: Schema.optional(Schema.Array(SharedObjective)),
});

export type GlobalSequencing = typeof GlobalSequencing.Type;

// ---------------------------------------------------------------------------
// StyleRef
// ---------------------------------------------------------------------------

export const StyleRef = Schema.Struct({
  id: Schema.String,
  version: Schema.optional(Schema.String),
});

export type StyleRef = typeof StyleRef.Type;

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export const Manifest = Schema.Struct({
  corm: Schema.Literal("1.0"),
  id: Schema.String,
  version: Schema.String,
  scormSource: ScormVersion,
  metadata: LOMMetadata,
  style: Schema.optional(StyleRef),
  tts: Schema.optional(TTSConfig),
  sequencing: Schema.optional(GlobalSequencing),
  organizations: Schema.Array(Organization),
});

export type Manifest = typeof Manifest.Type;
