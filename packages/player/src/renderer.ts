import { marked } from "marked";

/**
 * Convert a Markdown string to HTML.
 */
export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}
