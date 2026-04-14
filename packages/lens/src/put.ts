/**
 * CORM -> SCORM transpilation (the "put" direction of the Lens).
 *
 * Takes a CORM Manifest from @corm/schema and produces
 * a ScormManifest from @corm/scorm-parser.
 */
import { Effect } from "effect";
import type {
  ScormItem,
  ScormManifest,
  ScormOrganization,
  ScormResource,
} from "@corm/scorm-parser";
import type { ItemType, Manifest, Organization } from "@corm/schema";
import { LensError } from "./errors.ts";

/**
 * Generate a resource identifier from an item id.
 */
function resourceId(itemId: string): string {
  return `res-${itemId}`;
}

/**
 * Recursively map a CORM ItemType to a ScormItem, collecting resources along the way.
 */
function mapItem(
  item: ItemType,
  resources: ScormResource[],
): ScormItem {
  const href = item.content?.[0];

  // If this item has content, create a corresponding resource
  if (href !== undefined) {
    resources.push({
      identifier: resourceId(item.id),
      type: "webcontent",
      scormType: "sco",
      href,
      files: [href],
    });
  }

  const mapped: ScormItem = {
    identifier: item.id,
    title: item.title,
    isVisible: item.isVisible,
    children: [],
  };

  if (item.parameters !== undefined) {
    mapped.parameters = item.parameters;
  }

  if (href !== undefined) {
    mapped.identifierref = resourceId(item.id);
  }

  if (item.sequencing !== undefined) {
    mapped.sequencing = item.sequencing;
  }

  if (item.items !== undefined && item.items.length > 0) {
    mapped.children = item.items.map((child) => mapItem(child, resources));
  }

  return mapped;
}

/**
 * Map a CORM Organization to a ScormOrganization.
 */
function mapOrganization(
  org: Organization,
  resources: ScormResource[],
): ScormOrganization {
  return {
    identifier: org.id,
    title: org.title,
    items: org.items.map((item) => mapItem(item as ItemType, resources)),
  };
}

/**
 * Transpile a CORM Manifest back into a ScormManifest.
 */
export function cormToScorm(
  corm: Manifest,
): Effect.Effect<ScormManifest, LensError> {
  return Effect.try({
    try: () => {
      const resources: ScormResource[] = [];

      const organizations = corm.organizations.map((org) =>
        mapOrganization(org as Organization, resources)
      );

      const defaultOrgId = organizations.length > 0
        ? organizations[0].identifier
        : "";

      return {
        identifier: corm.id,
        version: corm.scormSource,
        title: corm.metadata.title,
        defaultOrgId,
        organizations,
        resources,
      } as ScormManifest;
    },
    catch: (error) =>
      new LensError({
        message: `Failed to transpile CORM to SCORM: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }),
  });
}
