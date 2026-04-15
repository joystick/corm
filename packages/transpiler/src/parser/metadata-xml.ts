/**
 * Extract LOM metadata from a SCORM manifest organization.
 *
 * Adapted for @xmldom/xmldom — uses XmlElement interface.
 */
import type { LOMMetadata } from "@corm/schema";
import { getChildText, type XmlElement } from "./xml-helpers.ts";

/**
 * Extract basic metadata from an organization element.
 * Full LOM metadata parsing can be extended later.
 */
export function parseOrganizationMetadata(orgEl: XmlElement): LOMMetadata {
  const title = getChildText(orgEl, "title") ?? "Untitled";
  return { title };
}
