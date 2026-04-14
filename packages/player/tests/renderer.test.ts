import { assertEquals } from "@std/assert";
import { renderMarkdown } from "../src/renderer.ts";

Deno.test("renderMarkdown converts heading", () => {
  const result = renderMarkdown("# Hello");
  assertEquals(result.trim(), "<h1>Hello</h1>");
});

Deno.test("renderMarkdown converts paragraph", () => {
  const result = renderMarkdown("Hello world");
  assertEquals(result.trim(), "<p>Hello world</p>");
});

Deno.test("renderMarkdown converts unordered list", () => {
  const result = renderMarkdown("- one\n- two\n- three");
  assertEquals(
    result.trim(),
    "<ul>\n<li>one</li>\n<li>two</li>\n<li>three</li>\n</ul>",
  );
});

Deno.test("renderMarkdown converts bold", () => {
  const result = renderMarkdown("**bold**");
  assertEquals(result.trim(), "<p><strong>bold</strong></p>");
});

Deno.test("renderMarkdown converts italic", () => {
  const result = renderMarkdown("*italic*");
  assertEquals(result.trim(), "<p><em>italic</em></p>");
});
