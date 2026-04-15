/**
 * Parse a full SCORM imsmanifest.xml into intermediate structures.
 *
 * Adapted for @xmldom/xmldom: uses "text/xml" parsing (proper XML),
 * no self-closing tag expansion needed, doc.documentElement is the root.
 */
import { DOMParser } from "@xmldom/xmldom";
import { Effect } from "effect";
import type { ScormVersion } from "@corm/schema";
import type { ItemSequencing } from "@corm/schema";
import { ScormParseError } from "./errors.ts";
import {
  findElement,
  findElements,
  getChildText,
  type XmlElement,
} from "./xml-helpers.ts";
import { parseSequencing } from "./sequencing-xml.ts";

// ---------------------------------------------------------------------------
// Intermediate types (not full CORM — that mapping is the Lens's job)
// ---------------------------------------------------------------------------

export interface ScormResource {
  identifier: string;
  type: string;
  scormType: string;
  href: string;
  files: string[];
}

export interface ScormItem {
  identifier: string;
  identifierref?: string;
  title: string;
  isVisible: boolean;
  parameters?: string;
  sequencing?: ItemSequencing;
  children: ScormItem[];
}

export interface ScormOrganization {
  identifier: string;
  title: string;
  items: ScormItem[];
}

export interface ScormManifest {
  identifier: string;
  version: ScormVersion;
  title: string;
  organizations: ScormOrganization[];
  resources: ScormResource[];
  defaultOrgId: string;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseItem(el: XmlElement, version: ScormVersion): ScormItem {
  const identifier = el.getAttribute("identifier") ?? "";
  const identifierref = el.getAttribute("identifierref") ?? undefined;
  const isVisible = el.getAttribute("isvisible") !== "false";
  const parameters = el.getAttribute("parameters") ?? undefined;
  const title = getChildText(el, "title") ?? "Untitled";

  // Parse sequencing (SCORM 2004 only)
  let sequencing: ItemSequencing | undefined;
  if (version !== "1.2") {
    const seqEl = findElement(el, "sequencing");
    if (seqEl) {
      sequencing = parseSequencing(seqEl);
    }
  }

  // Recursive child items
  const children = findElements(el, "item").map((child) =>
    parseItem(child, version)
  );

  return {
    identifier,
    identifierref,
    title,
    isVisible,
    parameters,
    sequencing,
    children,
  };
}

function parseResource(el: XmlElement): ScormResource {
  const identifier = el.getAttribute("identifier") ?? "";
  const type = el.getAttribute("type") ?? "";
  // Try both adlcp:scormtype (1.2) and adlcp:scormType (2004)
  const scormType = el.getAttribute("adlcp:scormtype") ??
    el.getAttribute("adlcp:scormType") ??
    el.getAttribute("scormtype") ??
    el.getAttribute("scormType") ??
    "";
  const href = el.getAttribute("href") ?? "";

  const files = findElements(el, "file").map(
    (f) => f.getAttribute("href") ?? "",
  );

  return { identifier, type, scormType, href, files };
}

/**
 * Parse raw imsmanifest.xml content into a ScormManifest.
 */
export function parseManifestXml(
  xml: string,
  version: ScormVersion,
): Effect.Effect<ScormManifest, ScormParseError> {
  return Effect.gen(function* () {
    const parser = new DOMParser();
    // Strip BOM (common in Articulate exports) and trim whitespace
    const cleanXml = xml.replace(/^\uFEFF/, "").trim();
    // xmldom uses proper XML parsing — no need for self-closing tag expansion
    const doc = parser.parseFromString(cleanXml, "text/xml");
    if (!doc) {
      return yield* new ScormParseError({
        message: "Failed to parse XML document",
      });
    }

    // xmldom returns the actual root element via documentElement
    const root = doc.documentElement as unknown as XmlElement;
    if (!root) {
      return yield* new ScormParseError({
        message: "No root element found",
      });
    }

    // Verify the root is a <manifest> element
    const rootTag = root.tagName.toLowerCase().replace(/^.*:/, "");
    if (rootTag !== "manifest") {
      return yield* new ScormParseError({
        message: `Expected <manifest> root element, got <${root.tagName}>`,
      });
    }

    const identifier = root.getAttribute("identifier") ?? "";

    const orgsEl = findElement(root, "organizations");
    if (!orgsEl) {
      return yield* new ScormParseError({
        message: "No <organizations> element found",
      });
    }

    const defaultOrgId = orgsEl.getAttribute("default") ?? "";

    const organizations = findElements(orgsEl, "organization").map((orgEl) => {
      const orgId = orgEl.getAttribute("identifier") ?? "";
      const orgTitle = getChildText(orgEl, "title") ?? "Untitled";
      const items = findElements(orgEl, "item").map((itemEl) =>
        parseItem(itemEl, version)
      );
      return { identifier: orgId, title: orgTitle, items };
    });

    // Find resources
    const resEl = findElement(root, "resources");

    const resources = resEl
      ? findElements(resEl, "resource").map(parseResource)
      : [];

    // Title from default organization
    const defaultOrg = organizations.find((o) => o.identifier === defaultOrgId);
    const title = defaultOrg?.title ?? organizations[0]?.title ?? "Untitled";

    return {
      identifier: identifier || "unknown",
      version,
      title,
      organizations,
      resources,
      defaultOrgId,
    };
  });
}
