import { assertEquals } from "@std/assert";
import { cormButton, cormCard, cormTheme } from "../src/styles/mod.ts";

Deno.test("theme: cormTheme contains --corm-primary variable", () => {
  const text = cormTheme.cssText;
  assertEquals(text.includes("--corm-primary:"), true);
});

Deno.test("theme: cormTheme contains --corm-background variable", () => {
  const text = cormTheme.cssText;
  assertEquals(text.includes("--corm-background:"), true);
});

Deno.test("theme: cormTheme contains fallback values using var(--xxx, fallback) pattern", () => {
  const text = cormTheme.cssText;
  // All bridged variables should use var(--shadcn-token, fallback)
  assertEquals(text.includes("var(--primary,"), true);
  assertEquals(text.includes("var(--background,"), true);
  assertEquals(text.includes("var(--foreground,"), true);
  assertEquals(text.includes("var(--secondary,"), true);
  assertEquals(text.includes("var(--destructive,"), true);
  assertEquals(text.includes("var(--ring,"), true);
  assertEquals(text.includes("var(--radius,"), true);
  assertEquals(text.includes("var(--border,"), true);
  assertEquals(text.includes("var(--card,"), true);
  assertEquals(text.includes("var(--muted,"), true);
});

Deno.test("theme: cormButton contains .corm-btn-primary class", () => {
  const text = cormButton.cssText;
  assertEquals(text.includes(".corm-btn-primary"), true);
});

Deno.test("theme: cormCard contains .corm-card-glass class", () => {
  const text = cormCard.cssText;
  assertEquals(text.includes(".corm-card-glass"), true);
});

Deno.test("theme: all theme variables bridge with var(--host, fallback)", () => {
  const text = cormTheme.cssText;
  // Extract all --corm-* variable declarations
  const declarations = text.match(/--corm-[\w-]+:\s*var\(--[\w-]+,/g) ?? [];
  // We expect at least the core set of bridged variables
  const expectedBridged = [
    "--corm-primary",
    "--corm-primary-foreground",
    "--corm-secondary",
    "--corm-secondary-foreground",
    "--corm-background",
    "--corm-foreground",
    "--corm-card",
    "--corm-card-foreground",
    "--corm-muted",
    "--corm-muted-foreground",
    "--corm-destructive",
    "--corm-border",
    "--corm-input",
    "--corm-ring",
    "--corm-radius",
  ];
  for (const varName of expectedBridged) {
    const found = declarations.some((d) => d.startsWith(varName + ":"));
    assertEquals(found, true, `Expected bridged variable ${varName}`);
  }
});

Deno.test("theme: seaducate.com default colors are present in fallbacks", () => {
  const text = cormTheme.cssText;
  // Navy background
  assertEquals(text.includes("hsl(217 39% 14%)"), true);
  // Brand gold
  assertEquals(text.includes("hsl(36 100% 58%)"), true);
  // Ocean cyan
  assertEquals(text.includes("hsl(187 79% 43%)"), true);
});

Deno.test("theme: default radius is 0.75rem (seaducate.com value)", () => {
  const text = cormTheme.cssText;
  assertEquals(text.includes("0.75rem"), true);
});

Deno.test("theme: cormCard contains backdrop-filter for glass morphism", () => {
  const text = cormCard.cssText;
  assertEquals(text.includes("backdrop-filter: blur("), true);
});

Deno.test("theme: cormButton contains all variant classes", () => {
  const text = cormButton.cssText;
  assertEquals(text.includes(".corm-btn-primary"), true);
  assertEquals(text.includes(".corm-btn-secondary"), true);
  assertEquals(text.includes(".corm-btn-outline"), true);
  assertEquals(text.includes(".corm-btn-ghost"), true);
});

Deno.test("theme: cormButton has focus-visible ring style", () => {
  const text = cormButton.cssText;
  assertEquals(text.includes("focus-visible"), true);
  assertEquals(text.includes("--corm-ring"), true);
});
