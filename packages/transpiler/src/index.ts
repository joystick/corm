/**
 * @corm/transpiler — SCORM to CORM transpiler for Node.js.
 *
 * Bundles the SCORM parser (adapted for @xmldom/xmldom) and the
 * SCORM<->CORM lens into a single npm-consumable package.
 */
import { Effect } from "effect";
import JSZip from "jszip";
import { detectVersion } from "./parser/version-detect.ts";
import { parseManifestXml, type ScormManifest } from "./parser/manifest-xml.ts";
import { scormToCorm } from "../../lens/src/get.ts";
import { verifyRoundTrip } from "../../lens/src/roundtrip.ts";
import { ScormManifestNotFound, ScormParseError } from "./parser/errors.ts";

// Re-export types consumers might need
export type {
  ScormItem,
  ScormManifest,
  ScormOrganization,
  ScormResource,
} from "./parser/manifest-xml.ts";
export type { RoundTripResult } from "../../lens/src/roundtrip.ts";

/**
 * Find imsmanifest.xml in a JSZip archive.
 */
function findManifest(
  zip: JSZip,
): Effect.Effect<string, ScormManifestNotFound> {
  return Effect.gen(function* () {
    const candidates = [
      "imsmanifest.xml",
      ...Object.keys(zip.files).filter((name) =>
        name.toLowerCase().endsWith("imsmanifest.xml")
      ),
    ];

    for (const candidate of candidates) {
      const file = zip.file(candidate);
      if (file) {
        const raw = yield* Effect.promise(() => file.async("string"));
        // Strip BOM (common in Articulate exports)
        return raw.replace(/^\uFEFF/, "");
      }
    }

    return yield* new ScormManifestNotFound({
      message: "imsmanifest.xml not found in SCORM package",
    });
  });
}

/**
 * Transpile a SCORM zip package to a CORM manifest.
 *
 * @param data - SCORM zip as Uint8Array or ArrayBuffer
 * @returns CORM manifest object ready to serialize as JSON
 */
export async function transpileScorm(
  data: Uint8Array | ArrayBuffer,
): Promise<Record<string, unknown>> {
  const program = Effect.gen(function* () {
    const zip = yield* Effect.tryPromise({
      try: () => JSZip.loadAsync(data),
      catch: (e) =>
        new ScormParseError({
          message: `Failed to unzip SCORM package: ${e}`,
        }),
    });

    const manifestXml = yield* findManifest(zip);
    const version = yield* detectVersion(manifestXml);
    const scormManifest = yield* parseManifestXml(manifestXml, version);
    const cormManifest = yield* scormToCorm(scormManifest);

    return cormManifest;
  });

  const result = await Effect.runPromise(program);
  return result as unknown as Record<string, unknown>;
}

/**
 * Parse a SCORM zip package without transpiling to CORM.
 * Returns the intermediate SCORM manifest representation.
 */
export async function parseScorm(
  data: Uint8Array | ArrayBuffer,
): Promise<ScormManifest> {
  const program = Effect.gen(function* () {
    const zip = yield* Effect.tryPromise({
      try: () => JSZip.loadAsync(data),
      catch: (e) =>
        new ScormParseError({
          message: `Failed to unzip: ${e}`,
        }),
    });

    const manifestXml = yield* findManifest(zip);
    const version = yield* detectVersion(manifestXml);
    return yield* parseManifestXml(manifestXml, version);
  });

  return await Effect.runPromise(program);
}

/**
 * Transpile SCORM to CORM and back, verifying round-trip fidelity.
 */
export async function verifyScormRoundTrip(
  data: Uint8Array | ArrayBuffer,
): Promise<{
  success: boolean;
  differences: string[];
  cormManifest: Record<string, unknown>;
}> {
  const program = Effect.gen(function* () {
    const zip = yield* Effect.tryPromise({
      try: () => JSZip.loadAsync(data),
      catch: (e) =>
        new ScormParseError({
          message: `Failed to unzip: ${e}`,
        }),
    });

    const manifestXml = yield* findManifest(zip);
    const version = yield* detectVersion(manifestXml);
    const scorm = yield* parseManifestXml(manifestXml, version);

    const rtResult = yield* verifyRoundTrip(scorm);
    const corm = yield* scormToCorm(scorm);

    return {
      success: rtResult.success,
      differences: rtResult.differences,
      cormManifest: corm as unknown as Record<string, unknown>,
    };
  });

  return await Effect.runPromise(program);
}
