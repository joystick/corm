/**
 * Extract LOM metadata from a SCORM manifest organization.
 */
import type { Element } from "deno-dom";
import type { LOMMetadata } from "@corm/schema";
import { getChildText } from "./xml-helpers.ts";

/**
 * Extract basic metadata from an organization element.
 * Full LOM metadata parsing can be extended later.
 */
export function parseOrganizationMetadata(orgEl: Element): LOMMetadata {
  const title = getChildText(orgEl, "title") ?? "Untitled";
  return { title };
}
