/**
 * XML namespace-aware element finders for @xmldom/xmldom.
 *
 * Adapted from the deno-dom version: uses childNodes filtered by
 * nodeType === 1 instead of the .children property (which xmldom
 * does not implement).
 *
 * We define a minimal XmlElement interface rather than relying on
 * the DOM global `Element` type, since Deno doesn't include the
 * DOM lib by default.
 */

/** Minimal Element interface covering what we actually use from xmldom. */
export interface XmlElement {
  readonly tagName: string;
  readonly textContent: string | null;
  readonly childNodes: NodeListLike;
  readonly nodeType: number;
  getAttribute(name: string): string | null;
}

interface NodeListLike {
  readonly length: number;
  [index: number]: { nodeType: number } & Record<string, unknown>;
}

/** Get direct child elements (nodeType === 1) from a parent element. */
function getChildElements(parent: XmlElement): XmlElement[] {
  const result: XmlElement[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1) result.push(node as unknown as XmlElement);
  }
  return result;
}

/** Find all child elements matching a local name (ignoring namespace prefix). */
export function findElements(
  parent: XmlElement,
  localName: string,
): XmlElement[] {
  return getChildElements(parent).filter(
    (el) =>
      el.tagName.toLowerCase() === localName.toLowerCase() ||
      el.tagName.toLowerCase().endsWith(":" + localName.toLowerCase()),
  );
}

/** Find first child element matching a local name (ignoring namespace prefix). */
export function findElement(
  parent: XmlElement,
  localName: string,
): XmlElement | null {
  return findElements(parent, localName)[0] ?? null;
}

/** Recursively find all descendant elements matching a local name. */
export function findElementsDeep(
  parent: XmlElement,
  localName: string,
): XmlElement[] {
  const results: XmlElement[] = [];
  for (const child of getChildElements(parent)) {
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
  parent: XmlElement,
  localName: string,
): string | null {
  const el = findElement(parent, localName);
  return el?.textContent?.trim() ?? null;
}
