import { assertEquals, assertExists } from "@std/assert";
import { Effect } from "effect";
import JSZip from "jszip";
import { ScormParserLive } from "@corm/scorm-parser";
import { ValidatorLive } from "@corm/validator";
import { convertPipeline, infoPipeline, validatePipeline } from "../src/cli.ts";

const SCORM12_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="test-pkg" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org-1">
    <organization identifier="org-1">
      <title>Test Course</title>
      <item identifier="item-1" identifierref="res-1">
        <title>Lesson 1</title>
      </item>
      <item identifier="item-2" identifierref="res-2">
        <title>Lesson 2</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-1" type="webcontent" adlcp:scormtype="sco" href="content/intro.html">
      <file href="content/intro.html"/>
    </resource>
    <resource identifier="res-2" type="webcontent" adlcp:scormtype="sco" href="content/lesson2.html">
      <file href="content/lesson2.html"/>
    </resource>
  </resources>
</manifest>`;

async function buildScormZip(manifestXml: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("imsmanifest.xml", manifestXml);
  zip.file("content/intro.html", "<html><body>Hello</body></html>");
  zip.file("content/lesson2.html", "<html><body>Lesson 2</body></html>");
  return await zip.generateAsync({ type: "uint8array" });
}

import { Layer } from "effect";
const TestLive = Layer.mergeAll(ScormParserLive, ValidatorLive);

// ---------------------------------------------------------------------------
// convert pipeline
// ---------------------------------------------------------------------------

Deno.test("convertPipeline: converts SCORM zip to CORM manifest", async () => {
  const zipData = await buildScormZip(SCORM12_MANIFEST);

  const program = convertPipeline(zipData).pipe(
    Effect.provide(TestLive),
  );

  const result = await Effect.runPromise(program);
  const manifest = result.cormManifest;

  assertEquals(manifest.corm, "1.0");
  assertEquals(manifest.id, "test-pkg");
  assertEquals(manifest.metadata.title, "Test Course");
  assertEquals(manifest.scormSource, "1.2");
  assertExists(manifest.organizations);
  assertEquals(manifest.organizations.length, 1);
  assertEquals(manifest.organizations[0].items.length, 2);
  assertEquals(manifest.organizations[0].items[0].title, "Lesson 1");
  assertEquals(manifest.organizations[0].items[1].title, "Lesson 2");
});

Deno.test("convertPipeline: with --verify runs round-trip check", async () => {
  const zipData = await buildScormZip(SCORM12_MANIFEST);

  const program = convertPipeline(zipData, { verify: true }).pipe(
    Effect.provide(TestLive),
  );

  const result = await Effect.runPromise(program);
  assertExists(result.roundTripResult);
  assertEquals(result.roundTripResult.success, true);
});

Deno.test("convertPipeline: without --verify skips round-trip", async () => {
  const zipData = await buildScormZip(SCORM12_MANIFEST);

  const program = convertPipeline(zipData, { verify: false }).pipe(
    Effect.provide(TestLive),
  );

  const result = await Effect.runPromise(program);
  assertEquals(result.roundTripResult, undefined);
});

// ---------------------------------------------------------------------------
// info pipeline
// ---------------------------------------------------------------------------

Deno.test("infoPipeline: returns package summary", async () => {
  const zipData = await buildScormZip(SCORM12_MANIFEST);

  const program = infoPipeline(zipData).pipe(
    Effect.provide(TestLive),
  );

  const info = await Effect.runPromise(program);
  assertEquals(info.version, "1.2");
  assertEquals(info.title, "Test Course");
  assertEquals(info.identifier, "test-pkg");
  assertEquals(info.organizationCount, 1);
  assertEquals(info.itemCount, 2);
  assertEquals(info.resourceCount, 2);
});

// ---------------------------------------------------------------------------
// validate pipeline
// ---------------------------------------------------------------------------

Deno.test("validatePipeline: valid manifest passes", async () => {
  const zipData = await buildScormZip(SCORM12_MANIFEST);

  // First convert to get a CORM manifest
  const convertProgram = convertPipeline(zipData).pipe(
    Effect.provide(TestLive),
  );
  const { cormManifest } = await Effect.runPromise(convertProgram);

  // Then validate it
  const validateProgram = validatePipeline(cormManifest).pipe(
    Effect.provide(TestLive),
  );
  const result = await Effect.runPromise(validateProgram);
  assertEquals(result.valid, true);
});

Deno.test("validatePipeline: empty object fails validation", async () => {
  const program = validatePipeline({}).pipe(
    Effect.provide(TestLive),
  );

  const result = await Effect.runPromise(program);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

// ---------------------------------------------------------------------------
// error handling
// ---------------------------------------------------------------------------

Deno.test("convertPipeline: fails on invalid zip data", async () => {
  const program = convertPipeline(new Uint8Array([1, 2, 3])).pipe(
    Effect.provide(TestLive),
  );

  const result = await Effect.runPromiseExit(program);
  assertEquals(result._tag, "Failure");
});

Deno.test("convertPipeline: fails on zip without manifest", async () => {
  const zip = new JSZip();
  zip.file("readme.txt", "no manifest here");
  const zipData = await zip.generateAsync({ type: "uint8array" });

  const program = convertPipeline(zipData).pipe(
    Effect.provide(TestLive),
  );

  const result = await Effect.runPromiseExit(program);
  assertEquals(result._tag, "Failure");
});
