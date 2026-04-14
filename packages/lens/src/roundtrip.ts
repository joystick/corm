/**
 * Round-trip verification: SCORM -> CORM -> SCORM.
 *
 * Verifies that a ScormManifest survives a get/put round trip
 * with semantic equivalence (not exact object equality, since
 * generated resource IDs may differ).
 */
import { Effect } from "effect";
import type { ScormManifest } from "@corm/scorm-parser";
import type { LensError } from "./errors.ts";
import { scormToCorm } from "./get.ts";
import { cormToScorm } from "./put.ts";

/**
 * Result of a round-trip verification.
 */
export interface RoundTripResult {
  readonly success: boolean;
  readonly original: ScormManifest;
  readonly roundTripped: ScormManifest;
  readonly differences: string[];
}

/**
 * Count all items in a ScormManifest (across all orgs, recursively).
 */
function countItems(manifest: ScormManifest): number {
  let count = 0;
  function walk(
    items: readonly { children: readonly unknown[] }[],
  ): void {
    for (const item of items) {
      count++;
      walk(
        item.children as readonly { children: readonly unknown[] }[],
      );
    }
  }
  for (const org of manifest.organizations) {
    walk(org.items);
  }
  return count;
}

/**
 * Check whether sequencing is present on any item in the manifest.
 */
function hasSequencing(manifest: ScormManifest): boolean {
  function walk(
    items: readonly { sequencing?: unknown; children: readonly unknown[] }[],
  ): boolean {
    for (const item of items) {
      if (item.sequencing !== undefined) return true;
      if (
        walk(
          item.children as readonly {
            sequencing?: unknown;
            children: readonly unknown[];
          }[],
        )
      ) return true;
    }
    return false;
  }
  for (const org of manifest.organizations) {
    if (walk(org.items)) return true;
  }
  return false;
}

/**
 * Run a round-trip verification on a ScormManifest.
 *
 * Performs: original -> scormToCorm -> cormToScorm -> compare
 */
export function verifyRoundTrip(
  original: ScormManifest,
): Effect.Effect<RoundTripResult, LensError> {
  return Effect.gen(function* () {
    const corm = yield* scormToCorm(original);
    const roundTripped = yield* cormToScorm(corm);
    const differences: string[] = [];

    // Compare identifier
    if (original.identifier !== roundTripped.identifier) {
      differences.push(
        `identifier: "${original.identifier}" -> "${roundTripped.identifier}"`,
      );
    }

    // Compare version
    if (original.version !== roundTripped.version) {
      differences.push(
        `version: "${original.version}" -> "${roundTripped.version}"`,
      );
    }

    // Compare title
    if (original.title !== roundTripped.title) {
      differences.push(
        `title: "${original.title}" -> "${roundTripped.title}"`,
      );
    }

    // Compare organization count
    if (
      original.organizations.length !== roundTripped.organizations.length
    ) {
      differences.push(
        `organization count: ${original.organizations.length} -> ${roundTripped.organizations.length}`,
      );
    }

    // Compare item count
    const origItemCount = countItems(original);
    const rtItemCount = countItems(roundTripped);
    if (origItemCount !== rtItemCount) {
      differences.push(
        `item count: ${origItemCount} -> ${rtItemCount}`,
      );
    }

    // Compare resource count
    if (original.resources.length !== roundTripped.resources.length) {
      differences.push(
        `resource count: ${original.resources.length} -> ${roundTripped.resources.length}`,
      );
    }

    // Compare sequencing presence
    const origHasSeq = hasSequencing(original);
    const rtHasSeq = hasSequencing(roundTripped);
    if (origHasSeq !== rtHasSeq) {
      differences.push(
        `sequencing presence: ${origHasSeq} -> ${rtHasSeq}`,
      );
    }

    return {
      success: differences.length === 0,
      original,
      roundTripped,
      differences,
    };
  });
}
