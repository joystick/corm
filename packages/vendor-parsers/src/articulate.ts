import { Effect } from "effect";
import { HtmlToMarkdown } from "./html-to-md.ts";
import type { VendorParser } from "./registry.ts";
import { VendorParseError } from "./errors.ts";

/** Detect Articulate Storyline content */
function isStoryline(html: string): boolean {
  return (
    html.includes("data-storyline") ||
    html.includes("storyline-slide") ||
    html.includes("slide-layer")
  );
}

/** Detect Articulate Rise content */
function isRise(html: string): boolean {
  return (
    html.includes('class="rise-') ||
    html.includes("rise-block") ||
    html.includes("rise-lesson")
  );
}

export const articulateParser: VendorParser = {
  name: "articulate",
  detect: (html: string) => isStoryline(html) || isRise(html),
  parse: (html: string) =>
    Effect.gen(function* () {
      const svc = yield* HtmlToMarkdown;
      return yield* svc.convert(html);
    }).pipe(
      Effect.mapError(
        (e) =>
          new VendorParseError({
            message: e instanceof VendorParseError ? e.message : String(e),
            vendor: "articulate",
          }),
      ),
    ),
};
