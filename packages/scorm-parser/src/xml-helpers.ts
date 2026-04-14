/**
 * XML namespace-aware element finders for deno-dom.
 *
 * deno-dom does not properly support XML namespaces, so we match
 * elements by local name, ignoring any namespace prefix.
 */
import type { Element } from "deno-dom";

/** Find all child elements matching a local name (ignoring namespace prefix). */
export function findElements(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter(
    (el) =>
      el.tagName.toLowerCase() === localName.toLowerCase() ||
      el.tagName.toLowerCase().endsWith(":" + localName.toLowerCase()),
  );
}

/** Find first child element matching a local name (ignoring namespace prefix). */
export function findElement(
  parent: Element,
  localName: string,
): Element | null {
  return findElements(parent, localName)[0] ?? null;
}

/** Recursively find all descendant elements matching a local name. */
export function findElementsDeep(
  parent: Element,
  localName: string,
): Element[] {
  const results: Element[] = [];
  for (const child of Array.from(parent.children)) {
    if (
      child.tagName.toLowerCase() === localName.toLowerCase() ||
      child.tagName.toLowerCase().endsWith(":" + localName.toLowerCase())
    ) {
      results.push(child);
    }
    results.push(...findElementsDeep(child, localName));
  }
  return results;
}

/** Get text content of the first matching child element. */
export function getChildText(
  parent: Element,
  localName: string,
): string | null {
  const el = findElement(parent, localName);
  return el?.textContent?.trim() ?? null;
}
