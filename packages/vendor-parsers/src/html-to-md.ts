import { Context, Effect, Layer } from "effect";
import { DOMParser, type Element, type Node } from "deno-dom";
import { VendorParseError } from "./errors.ts";

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface HtmlToMarkdownService {
  readonly convert: (html: string) => Effect.Effect<string, VendorParseError>;
}

export class HtmlToMarkdown extends Context.Tag("HtmlToMarkdown")<
  HtmlToMarkdown,
  HtmlToMarkdownService
>() {}

// ---------------------------------------------------------------------------
// DOM walker
// ---------------------------------------------------------------------------

interface WalkContext {
  /** Current ordered-list counter (0 = not in an OL) */
  olIndex: number;
}

function walkNode(node: Node, ctx: WalkContext): string {
  // Text node
  if (node.nodeType === 3) {
    return node.textContent ?? "";
  }

  // Element node
  if (node.nodeType !== 1) return "";

  const el = node as unknown as Element;
  const tag = el.tagName; // UPPER in deno-dom HTML mode
  const children = () =>
    Array.from(el.childNodes)
      .map((c) => walkNode(c as Node, ctx))
      .join("");

  switch (tag) {
    // Headings
    case "H1":
      return `# ${children().trim()}\n\n`;
    case "H2":
      return `## ${children().trim()}\n\n`;
    case "H3":
      return `### ${children().trim()}\n\n`;
    case "H4":
      return `#### ${children().trim()}\n\n`;
    case "H5":
      return `##### ${children().trim()}\n\n`;
    case "H6":
      return `###### ${children().trim()}\n\n`;

    // Block elements
    case "P":
      return `${children().trim()}\n\n`;
    case "BR":
      return "\n";
    case "BLOCKQUOTE":
      return children()
        .trim()
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n") + "\n\n";
    case "PRE": {
      const code = el.querySelector("code");
      const text = code ? code.textContent ?? "" : children();
      return "```\n" + text.trim() + "\n```\n\n";
    }
    case "CODE": {
      // Inline code (PRE>CODE handled above)
      if (
        el.parentElement &&
        (el.parentElement as unknown as Element).tagName === "PRE"
      ) {
        return children();
      }
      return "`" + children() + "`";
    }

    // Lists
    case "UL": {
      const items = Array.from(el.childNodes)
        .map((c) => walkNode(c as Node, { ...ctx, olIndex: 0 }))
        .join("");
      return items + "\n";
    }
    case "OL": {
      let idx = 0;
      const items = Array.from(el.childNodes)
        .map((c) => {
          if (
            (c as unknown as Element).tagName === "LI"
          ) {
            idx++;
            return walkNode(c as Node, { ...ctx, olIndex: idx });
          }
          return walkNode(c as Node, ctx);
        })
        .join("");
      return items + "\n";
    }
    case "LI": {
      const content = children().trim();
      if (ctx.olIndex > 0) {
        return `${ctx.olIndex}. ${content}\n`;
      }
      return `- ${content}\n`;
    }

    // Inline formatting
    case "STRONG":
    case "B":
      return `**${children()}**`;
    case "EM":
    case "I":
      return `*${children()}*`;

    // Links & images
    case "A": {
      const href = el.getAttribute("href") ?? "";
      return `[${children()}](${href})`;
    }
    case "IMG": {
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      return `![${alt}](${src})`;
    }

    // Tables
    case "TABLE":
      return children() + "\n";
    case "THEAD":
    case "TBODY":
      return children();
    case "TR": {
      const cells = Array.from(el.children).map((cell) =>
        walkNode(cell as unknown as Node, ctx).trim()
      );
      const row = "| " + cells.join(" | ") + " |";
      // If this row is inside THEAD, append separator
      if (
        el.parentElement &&
        (el.parentElement as unknown as Element).tagName === "THEAD"
      ) {
        const sep = "| " + cells.map(() => "---").join(" | ") + " |";
        return row + "\n" + sep + "\n";
      }
      return row + "\n";
    }
    case "TH":
    case "TD":
      return children();

    // Divs, spans, etc. -- pass through
    default:
      return children();
  }
}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

export const HtmlToMarkdownLive: Layer.Layer<HtmlToMarkdown> = Layer.succeed(
  HtmlToMarkdown,
  HtmlToMarkdown.of({
    convert: (html: string) =>
      Effect.try({
        try: () => {
          const doc = new DOMParser().parseFromString(html, "text/html");
          if (!doc) throw new Error("Failed to parse HTML");

          const body = doc.body ?? doc.documentElement;
          if (!body) throw new Error("No body element found");

          const md = Array.from(body.childNodes)
            .map((n) => walkNode(n as Node, { olIndex: 0 }))
            .join("");

          // Clean up excessive newlines
          return md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
        },
        catch: (e) =>
          new VendorParseError({
            message: `HTML to Markdown conversion failed: ${e}`,
          }),
      }),
  }),
);
