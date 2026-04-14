import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import { HtmlToMarkdown, HtmlToMarkdownLive } from "../src/html-to-md.ts";

function convert(html: string): string {
  return Effect.runSync(
    Effect.gen(function* () {
      const svc = yield* HtmlToMarkdown;
      return yield* svc.convert(html);
    }).pipe(Effect.provide(HtmlToMarkdownLive)),
  );
}

Deno.test("converts headings", () => {
  assertEquals(convert("<h1>Title</h1>"), "# Title\n");
  assertEquals(convert("<h2>Sub</h2>"), "## Sub\n");
  assertEquals(convert("<h3>Deep</h3>"), "### Deep\n");
});

Deno.test("converts paragraphs", () => {
  assertEquals(convert("<p>Hello world</p>"), "Hello world\n");
});

Deno.test("converts bold and italic", () => {
  assertEquals(
    convert("<p><strong>bold</strong> and <em>italic</em></p>"),
    "**bold** and *italic*\n",
  );
  assertEquals(
    convert("<p><b>bold</b> and <i>italic</i></p>"),
    "**bold** and *italic*\n",
  );
});

Deno.test("converts unordered lists", () => {
  const html = "<ul><li>one</li><li>two</li></ul>";
  assertEquals(convert(html), "- one\n- two\n");
});

Deno.test("converts ordered lists", () => {
  const html = "<ol><li>first</li><li>second</li></ol>";
  assertEquals(convert(html), "1. first\n2. second\n");
});

Deno.test("converts links", () => {
  assertEquals(
    convert('<a href="https://example.com">click</a>'),
    "[click](https://example.com)\n",
  );
});

Deno.test("converts images", () => {
  assertEquals(
    convert('<img src="pic.png" alt="A picture">'),
    "![A picture](pic.png)\n",
  );
});

Deno.test("converts tables", () => {
  const html = `
    <table>
      <thead><tr><th>A</th><th>B</th></tr></thead>
      <tbody><tr><td>1</td><td>2</td></tr></tbody>
    </table>
  `;
  const md = convert(html);
  assertEquals(md.includes("| A | B |"), true);
  assertEquals(md.includes("| --- | --- |"), true);
  assertEquals(md.includes("| 1 | 2 |"), true);
});

Deno.test("converts code blocks", () => {
  const html = "<pre><code>const x = 1;</code></pre>";
  const md = convert(html);
  assertEquals(md.includes("```"), true);
  assertEquals(md.includes("const x = 1;"), true);
});

Deno.test("converts inline code", () => {
  assertEquals(
    convert("<p>use <code>deno</code> here</p>"),
    "use `deno` here\n",
  );
});
