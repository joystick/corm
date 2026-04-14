import { assertEquals } from "@std/assert";
import { detectContentType, resolveContent } from "../src/content/detector.ts";

Deno.test("detectContentType", async (t) => {
  await t.step(".html extension -> sco", () => {
    assertEquals(detectContentType("index.html"), "sco");
  });

  await t.step(".htm extension -> sco", () => {
    assertEquals(detectContentType("lesson.htm"), "sco");
  });

  await t.step(".md extension -> markdown", () => {
    assertEquals(detectContentType("lesson.md"), "markdown");
  });

  await t.step("content starting with '# ' -> markdown", () => {
    assertEquals(detectContentType("# Hello World"), "markdown");
  });

  await t.step("content starting with '## ' -> markdown", () => {
    assertEquals(detectContentType("## Section Two"), "markdown");
  });

  await t.step("index_lms.html -> sco", () => {
    assertEquals(detectContentType("index_lms.html"), "sco");
  });

  await t.step('array ["content/intro.html"] -> sco', () => {
    assertEquals(detectContentType(["content/intro.html"]), "sco");
  });

  await t.step('array ["slides/lesson1.md"] -> markdown', () => {
    assertEquals(detectContentType(["slides/lesson1.md"]), "markdown");
  });

  await t.step("empty string -> sco (default)", () => {
    assertEquals(detectContentType(""), "sco");
  });

  await t.step("plain URL without extension -> sco (default)", () => {
    assertEquals(detectContentType("https://example.com/content"), "sco");
  });

  await t.step("path with query params and .html -> sco", () => {
    assertEquals(detectContentType("page.html?v=2"), "sco");
  });

  await t.step("path with query params and .md -> markdown", () => {
    assertEquals(detectContentType("readme.md?raw=true"), "markdown");
  });

  await t.step("empty array -> sco (default)", () => {
    assertEquals(detectContentType([]), "sco");
  });

  await t.step("markdown bullet list content -> markdown", () => {
    assertEquals(detectContentType("- item one\n- item two"), "markdown");
  });

  await t.step("markdown link at start of line -> markdown", () => {
    assertEquals(
      detectContentType("[docs](https://example.com)"),
      "markdown",
    );
  });

  await t.step("plain text without markdown markers -> sco", () => {
    assertEquals(
      detectContentType("See the documentation for details"),
      "sco",
    );
  });
});

Deno.test("resolveContent", async (t) => {
  await t.step("markdown file returns markdown info", () => {
    const info = resolveContent("lesson.md");
    assertEquals(info.type, "markdown");
    assertEquals(info.markdown, "lesson.md");
    assertEquals(info.url, undefined);
  });

  await t.step("html file returns sco info", () => {
    const info = resolveContent("index.html");
    assertEquals(info.type, "sco");
    assertEquals(info.url, "index.html");
    assertEquals(info.markdown, undefined);
  });

  await t.step("array input resolves first element", () => {
    const info = resolveContent(["slides/intro.html", "slides/part2.html"]);
    assertEquals(info.type, "sco");
    assertEquals(info.url, "slides/intro.html");
  });
});
