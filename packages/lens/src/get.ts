/**
 * SCORM -> CORM transpilation (the "get" direction of the Lens).
 *
 * Takes a parsed ScormManifest from @corm/scorm-parser and produces
 * a CORM Manifest from @corm/schema.
 */
import { Effect } from "effect";
import type {
  ScormItem,
  ScormManifest,
  ScormResource,
} from "@corm/scorm-parser";
import type { ItemType, Manifest, Organization } from "@corm/schema";
import { LensError } from "./errors.ts";

/**
 * Build a lookup map from resource identifier to href.
 */
function buildResourceMap(
  resources: readonly ScormResource[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of resources) {
    if (r.identifier && r.href) {
      map.set(r.identifier, r.href);
    }
  }
  return map;
}

/**
 * Recursively map a ScormItem to a CORM ItemType.
 */
function mapItem(
  item: ScormItem,
  resourceMap: Map<string, string>,
): ItemType {
  const content = item.identifierref
    ? resourceMap.get(item.identifierref)
    : undefined;

  const mapped: ItemType = {
    id: item.identifier,
    title: item.title,
    isVisible: item.isVisible,
  };

  if (item.parameters !== undefined) {
    mapped.parameters = item.parameters;
  }

  if (content !== undefined) {
    mapped.content = [content];
  }

  if (item.sequencing !== undefined) {
    mapped.sequencing = item.sequencing;
  }

  if (item.children.length > 0) {
    mapped.items = item.children.map((child) => mapItem(child, resourceMap));
  }

  return mapped;
}

/**
 * Transpile a parsed SCORM manifest into a CORM Manifest.
 */
export function scormToCorm(
  scorm: ScormManifest,
): Effect.Effect<Manifest, LensError> {
  return Effect.try({
    try: () => {
      const resourceMap = buildResourceMap(scorm.resources);

      const organizations: readonly Organization[] = scorm.organizations.map(
        (org) => ({
          id: org.identifier,
          title: org.title,
          items: org.items.map((item) =>
            mapItem(item, resourceMap)
          ) as readonly ItemType[],
        }),
      );

      return {
        corm: "1.0" as const,
        id: scorm.identifier,
        version: "0.1.0",
        scormSource: scorm.version,
        metadata: {
          title: scorm.title,
        },
        organizations,
      } as Manifest;
    },
    catch: (error) =>
      new LensError({
        message: `Failed to transpile SCORM to CORM: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }),
  });
}
