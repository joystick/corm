/**
 * ScormParser — Effect service: unzip, detect version, parse manifest.
 */
import { Context, Effect, Layer } from "effect";
import JSZip from "jszip";
import { detectVersion } from "./version-detect.ts";
import { parseManifestXml, type ScormManifest } from "./manifest-xml.ts";
import {
  ScormManifestNotFound,
  ScormParseError,
  type ScormVersionUnsupported,
} from "./errors.ts";

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface ScormParserService {
  /**
   * Parse a SCORM zip package (as Uint8Array or ArrayBuffer) into a ScormManifest.
   */
  readonly parse: (
    data: Uint8Array | ArrayBuffer,
  ) => Effect.Effect<
    ScormManifest,
    ScormParseError | ScormManifestNotFound | ScormVersionUnsupported
  >;
}

export class ScormParser extends Context.Tag("ScormParser")<
  ScormParser,
  ScormParserService
>() {}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const findManifest = (
  zip: JSZip,
): Effect.Effect<string, ScormManifestNotFound> => {
  return Effect.gen(function* () {
    // Look for imsmanifest.xml at root or one level deep
    const candidates = [
      "imsmanifest.xml",
      ...Object.keys(zip.files).filter((name) =>
        name.toLowerCase().endsWith("imsmanifest.xml")
      ),
    ];

    for (const candidate of candidates) {
      const file = zip.file(candidate);
      if (file) {
        return yield* Effect.promise(() => file.async("string"));
      }
    }

    return yield* new ScormManifestNotFound({
      message: "imsmanifest.xml not found in SCORM package",
    });
  });
};

export const ScormParserLive = Layer.succeed(ScormParser, {
  parse: (data: Uint8Array | ArrayBuffer) =>
    Effect.gen(function* () {
      const zip = yield* Effect.tryPromise({
        try: () => JSZip.loadAsync(data),
        catch: (e) =>
          new ScormParseError({
            message: `Failed to unzip SCORM package: ${e}`,
          }),
      });

      const manifestXml = yield* findManifest(zip);
      const version = yield* detectVersion(manifestXml);
      const manifest = yield* parseManifestXml(manifestXml, version);

      return manifest;
    }),
});
