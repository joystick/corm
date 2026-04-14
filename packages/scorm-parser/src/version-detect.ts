import { Effect } from "effect";
import type { ScormVersion } from "@corm/schema";
import { ScormVersionUnsupported } from "./errors.ts";

/**
 * Maps raw schemaversion text to a normalized ScormVersion.
 */
const VERSION_MAP: Record<string, ScormVersion> = {
  "1.2": "1.2",
  "2004 2nd edition": "2004-2nd",
  "2004 3rd edition": "2004-3rd",
  "2004 4th edition": "2004-4th",
  // Common variants
  "cam 1.3": "2004-3rd",
  "2004": "2004-4th",
};

/**
 * Extract <schemaversion> content from raw XML using regex.
 */
function extractSchemaVersion(xml: string): string | null {
  const match = xml.match(/<schemaversion\s*>(.*?)<\/schemaversion\s*>/is);
  return match ? match[1].trim() : null;
}

/**
 * Detect SCORM version from namespace URIs as fallback.
 */
function detectFromNamespace(xml: string): ScormVersion | null {
  if (xml.includes("adlcp_rootv1p2")) return "1.2";
  if (xml.includes("adlcp_v1p3")) return "2004-4th";
  return null;
}

/**
 * Detect SCORM version from raw manifest XML.
 * Returns Effect that succeeds with ScormVersion or fails with ScormVersionUnsupported.
 */
export function detectVersion(
  xml: string,
): Effect.Effect<ScormVersion, ScormVersionUnsupported> {
  return Effect.gen(function* () {
    const raw = extractSchemaVersion(xml);

    if (raw) {
      const normalized = raw.toLowerCase();
      const version = VERSION_MAP[normalized];
      if (version) return version;
    }

    // Fallback to namespace detection
    const nsVersion = detectFromNamespace(xml);
    if (nsVersion) return nsVersion;

    return yield* new ScormVersionUnsupported({
      version: raw ?? "unknown",
      message: `Unsupported SCORM version: ${raw ?? "not found"}`,
    });
  });
}
