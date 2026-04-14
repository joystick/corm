/**
 * Integration test — Full SCORM → CORM → SCORM Round-Trip
 *
 * Exercises the complete pipeline using real SCORM fixture files:
 *   ScormParser → scormToCorm (lens get) → Validator → cormToScorm (lens put) → verifyRoundTrip
 */
import { assertEquals, assertExists } from "@std/assert";
import { Effect, Layer } from "effect";
import JSZip from "jszip";
import { ScormParser, ScormParserLive } from "@corm/scorm-parser";
import { cormToScorm, scormToCorm, verifyRoundTrip } from "@corm/lens";
import { Validator, ValidatorLive } from "@corm/validator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a fixture XML file and build a zip containing it as imsmanifest.xml. */
async function buildZipFromFixture(fixturePath: string): Promise<Uint8Array> {
  const xml = await Deno.readTextFile(fixturePath);
  const zip = new JSZip();
  zip.file("imsmanifest.xml", xml);
  return zip.generateAsync({ type: "uint8array" });
}

/** Provide both ScormParserLive and ValidatorLive layers. */
const FullLayer = Layer.merge(ScormParserLive, ValidatorLive);

// ---------------------------------------------------------------------------
// SCORM 1.2 full round-trip
// ---------------------------------------------------------------------------

Deno.test("SCORM 1.2 full round-trip", async () => {
  const zipData = await buildZipFromFixture(
    "fixtures/minimal-scorm12/imsmanifest.xml",
  );

  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const parser = yield* ScormParser;
      const validator = yield* Validator;

      // 1. Parse zip → ScormManifest
      const scorm = yield* parser.parse(zipData);
      assertEquals(scorm.version, "1.2");
      assertEquals(scorm.title, "Fire Safety Training");
      assertEquals(scorm.identifier, "com.example.fire-safety-12");

      // 2. Convert to CORM
      const corm = yield* scormToCorm(scorm);
      assertEquals(corm.id, "com.example.fire-safety-12");
      assertEquals(corm.metadata.title, "Fire Safety Training");
      assertEquals(corm.organizations.length, 1);
      assertExists(corm.organizations[0].items);
      assertEquals(corm.organizations[0].items.length, 2);

      // 3. Validate CORM manifest
      const validation = yield* validator.validate(corm);
      assertEquals(
        validation.valid,
        true,
        `Validation errors: ${JSON.stringify(validation.errors)}`,
      );

      // 4. Convert back to SCORM
      const scormBack = yield* cormToScorm(corm);
      assertEquals(scormBack.version, "1.2");
      assertEquals(scormBack.title, "Fire Safety Training");
      assertEquals(scormBack.identifier, "com.example.fire-safety-12");

      // 5. Round-trip verification
      const rt = yield* verifyRoundTrip(scorm);
      assertEquals(
        rt.success,
        true,
        `Round-trip differences: ${rt.differences.join(", ")}`,
      );

      return rt;
    }).pipe(Effect.provide(FullLayer)),
  );

  assertExists(result);
});

// ---------------------------------------------------------------------------
// SCORM 2004 full round-trip
// ---------------------------------------------------------------------------

Deno.test("SCORM 2004 full round-trip", async () => {
  const zipData = await buildZipFromFixture(
    "fixtures/minimal-scorm2004/imsmanifest.xml",
  );

  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const parser = yield* ScormParser;
      const validator = yield* Validator;

      // 1. Parse zip → ScormManifest
      const scorm = yield* parser.parse(zipData);
      assertEquals(scorm.version, "2004-4th");
      assertEquals(scorm.title, "Fire Safety Training");

      // Verify sequencing is present on parsed items
      const hasSequencing = scorm.organizations[0].items.some(
        (item) => item.sequencing !== undefined,
      );
      assertEquals(
        hasSequencing,
        true,
        "SCORM 2004 items should have sequencing",
      );

      // 2. Convert to CORM
      const corm = yield* scormToCorm(scorm);
      assertExists(corm.organizations[0].items);
      assertEquals(corm.organizations[0].items.length, 2);

      // Verify sequencing survived the conversion
      const cormHasSequencing = corm.organizations[0].items.some(
        (item) => item.sequencing !== undefined,
      );
      assertEquals(
        cormHasSequencing,
        true,
        "CORM items should preserve sequencing",
      );

      // 3. Validate CORM manifest
      const validation = yield* validator.validate(corm);
      assertEquals(
        validation.valid,
        true,
        `Validation errors: ${JSON.stringify(validation.errors)}`,
      );

      // 4. Convert back to SCORM
      const scormBack = yield* cormToScorm(corm);
      assertEquals(scormBack.version, "2004-4th");

      // Verify sequencing survives the round-trip
      const rtHasSequencing = scormBack.organizations[0].items.some(
        (item) => item.sequencing !== undefined,
      );
      assertEquals(
        rtHasSequencing,
        true,
        "Round-tripped SCORM should preserve sequencing",
      );

      // 5. Round-trip verification
      const rt = yield* verifyRoundTrip(scorm);
      assertEquals(
        rt.success,
        true,
        `Round-trip differences: ${rt.differences.join(", ")}`,
      );

      return rt;
    }).pipe(Effect.provide(FullLayer)),
  );

  assertExists(result);
});

// ---------------------------------------------------------------------------
// Pipeline error handling
// ---------------------------------------------------------------------------

Deno.test("Invalid zip data produces parse error", async () => {
  const invalidData = new Uint8Array([0, 1, 2, 3, 4, 5]);

  const result = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const parser = yield* ScormParser;
      return yield* parser.parse(invalidData);
    }).pipe(Effect.provide(ScormParserLive)),
  );

  // Should fail with ScormParseError
  assertEquals(result._tag, "Failure");
});

Deno.test("Zip without manifest produces manifest-not-found error", async () => {
  const zip = new JSZip();
  zip.file("readme.txt", "This is not a SCORM package");
  const zipData = await zip.generateAsync({ type: "uint8array" });

  const result = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const parser = yield* ScormParser;
      return yield* parser.parse(zipData);
    }).pipe(Effect.provide(ScormParserLive)),
  );

  // Should fail with ScormManifestNotFound
  assertEquals(result._tag, "Failure");
});
