import { Context, Effect, Layer } from "effect";
import { HtmlToMarkdown } from "./html-to-md.ts";
import type { VendorParseError } from "./errors.ts";
import { articulateParser } from "./articulate.ts";

// ---------------------------------------------------------------------------
// VendorParser interface
// ---------------------------------------------------------------------------

export interface VendorParser {
  readonly name: string;
  readonly detect: (html: string) => boolean;
  readonly parse: (
    html: string,
  ) => Effect.Effect<string, VendorParseError, HtmlToMarkdown>;
}

// ---------------------------------------------------------------------------
// Generic (fallback) parser
// ---------------------------------------------------------------------------

export const genericParser: VendorParser = {
  name: "generic",
  detect: (_html: string) => true,
  parse: (html: string) =>
    Effect.gen(function* () {
      const svc = yield* HtmlToMarkdown;
      return yield* svc.convert(html);
    }),
};

// ---------------------------------------------------------------------------
// Registry service
// ---------------------------------------------------------------------------

export interface VendorRegistryService {
  readonly detect: (html: string) => string;
  readonly parse: (
    html: string,
  ) => Effect.Effect<string, VendorParseError, HtmlToMarkdown>;
}

export class VendorRegistry extends Context.Tag("VendorRegistry")<
  VendorRegistry,
  VendorRegistryService
>() {}

// ---------------------------------------------------------------------------
// detectVendor — standalone utility
// ---------------------------------------------------------------------------

const defaultParsers: ReadonlyArray<VendorParser> = [
  articulateParser,
  genericParser,
];

export function detectVendor(html: string): string {
  for (const p of defaultParsers) {
    if (p.detect(html)) return p.name;
  }
  return "generic";
}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

export const VendorRegistryLive: Layer.Layer<VendorRegistry> = Layer.succeed(
  VendorRegistry,
  VendorRegistry.of({
    detect: (html: string): string => detectVendor(html),
    parse: (html: string) => {
      const parser = defaultParsers.find((p) => p.detect(html)) ??
        genericParser;
      return parser.parse(html);
    },
  }),
);
