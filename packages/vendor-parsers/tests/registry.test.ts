import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import { detectVendor } from "../src/registry.ts";
import {
  HtmlToMarkdownLive,
  VendorRegistry,
  VendorRegistryLive,
} from "../src/mod.ts";

Deno.test("detectVendor returns 'articulate' for storyline markers", () => {
  assertEquals(
    detectVendor('<div data-storyline="true">content</div>'),
    "articulate",
  );
});

Deno.test("detectVendor returns 'articulate' for rise markers", () => {
  assertEquals(
    detectVendor('<div class="rise-block">content</div>'),
    "articulate",
  );
});

Deno.test("detectVendor returns 'generic' for plain HTML", () => {
  assertEquals(detectVendor("<p>Hello</p>"), "generic");
});

Deno.test("VendorRegistry.parse converts generic HTML", () => {
  const result = Effect.runSync(
    Effect.gen(function* () {
      const reg = yield* VendorRegistry;
      return yield* reg.parse("<p>Hello world</p>");
    }).pipe(
      Effect.provide(VendorRegistryLive),
      Effect.provide(HtmlToMarkdownLive),
    ),
  );
  assertEquals(result, "Hello world\n");
});

Deno.test("VendorRegistry.detect identifies vendor", () => {
  const result = Effect.runSync(
    Effect.gen(function* () {
      const reg = yield* VendorRegistry;
      return reg.detect('<div data-storyline="true">x</div>');
    }).pipe(Effect.provide(VendorRegistryLive)),
  );
  assertEquals(result, "articulate");
});

Deno.test("VendorRegistry.parse handles articulate content", () => {
  const html = '<div data-storyline="true"><h1>Lesson</h1><p>Content</p></div>';
  const result = Effect.runSync(
    Effect.gen(function* () {
      const reg = yield* VendorRegistry;
      return yield* reg.parse(html);
    }).pipe(
      Effect.provide(VendorRegistryLive),
      Effect.provide(HtmlToMarkdownLive),
    ),
  );
  assertEquals(result.includes("# Lesson"), true);
  assertEquals(result.includes("Content"), true);
});
