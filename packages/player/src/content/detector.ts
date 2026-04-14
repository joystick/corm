/**
 * Content type detection for CORM player.
 *
 * Determines whether content should be rendered as native markdown
 * or loaded as a vendor SCO (HTML) in an iframe.
 */

/** Discriminated content types supported by the player. */
export type ContentType = "markdown" | "sco";

/** Resolved content info after detection. */
export interface ContentInfo {
  type: ContentType;
  /** For SCO: the HTML entry point URL. */
  url?: string;
  /** For markdown: the raw content string. */
  markdown?: string;
}

/** Markdown heading pattern: line starting with one or more `#`. */
const MARKDOWN_HEADING_RE = /^#{1,6}\s/;

/** Common markdown patterns beyond headings. */
const MARKDOWN_PATTERNS_RE =
  /^([-*]\s|\d+\.\s|>\s|```|!\[|\[.+\]\(.+\)|\*\*|__)/m;

/**
 * Detect whether a content reference is markdown or a SCO HTML entry point.
 *
 * Detection rules (in order):
 * 1. Array input — check the first element
 * 2. `.md` extension — markdown
 * 3. `.html` / `.htm` extension — sco
 * 4. Content starting with markdown heading (`# `) — markdown
 * 5. Content containing markdown-like patterns — markdown
 * 6. Default — sco (HTML content from SCORM packages)
 */
export function detectContentType(content: string | string[]): ContentType {
  if (Array.isArray(content)) {
    if (content.length === 0) return "sco";
    return detectContentType(content[0]);
  }

  const trimmed = content.trim();
  if (trimmed === "") return "sco";

  // Check file extension
  const extensionMatch = trimmed.split("?")[0].match(/\.(\w+)$/);
  if (extensionMatch) {
    const ext = extensionMatch[1].toLowerCase();
    if (ext === "md") return "markdown";
    if (ext === "html" || ext === "htm") return "sco";
  }

  // Check for markdown patterns in the content itself
  if (MARKDOWN_HEADING_RE.test(trimmed)) return "markdown";
  if (MARKDOWN_PATTERNS_RE.test(trimmed)) return "markdown";

  // Default: treat as SCO
  return "sco";
}

/**
 * Resolve a content reference into a {@link ContentInfo} with the
 * appropriate type and payload.
 */
export function resolveContent(content: string | string[]): ContentInfo {
  const type = detectContentType(content);
  const raw = Array.isArray(content) ? content[0] : content;

  if (type === "markdown") {
    return { type, markdown: raw };
  }

  return { type, url: raw };
}
