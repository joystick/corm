import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import JSZip from "jszip";
import { ScormParser, ScormParserLive } from "../src/parser.ts";

async function buildScormZip(
  manifestXml: string,
): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("imsmanifest.xml", manifestXml);
  zip.file("content/intro.html", "<html><body>Hello</body></html>");
  return await zip.generateAsync({ type: "uint8array" });
}

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
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-1" type="webcontent" adlcp:scormtype="sco" href="content/intro.html">
      <file href="content/intro.html"/>
    </resource>
  </resources>
</manifest>`;

Deno.test("ScormParser: parses SCORM 1.2 zip package", async () => {
  const zipData = await buildScormZip(SCORM12_MANIFEST);

  const program = Effect.gen(function* () {
    const parser = yield* ScormParser;
    return yield* parser.parse(zipData);
  }).pipe(Effect.provide(ScormParserLive));

  const manifest = await Effect.runPromise(program);
  assertEquals(manifest.version, "1.2");
  assertEquals(manifest.title, "Test Course");
  assertEquals(manifest.organizations.length, 1);
  assertEquals(manifest.organizations[0].items.length, 1);
  assertEquals(manifest.organizations[0].items[0].title, "Lesson 1");
  assertEquals(manifest.resources.length, 1);
  assertEquals(manifest.resources[0].scormType, "sco");
});

Deno.test("ScormParser: fails on invalid zip", async () => {
  const program = Effect.gen(function* () {
    const parser = yield* ScormParser;
    return yield* parser.parse(new Uint8Array([1, 2, 3]));
  }).pipe(Effect.provide(ScormParserLive));

  const result = await Effect.runPromiseExit(program);
  assertEquals(result._tag, "Failure");
});

Deno.test("ScormParser: fails when no manifest in zip", async () => {
  const zip = new JSZip();
  zip.file("readme.txt", "no manifest here");
  const zipData = await zip.generateAsync({ type: "uint8array" });

  const program = Effect.gen(function* () {
    const parser = yield* ScormParser;
    return yield* parser.parse(zipData);
  }).pipe(Effect.provide(ScormParserLive));

  const result = await Effect.runPromiseExit(program);
  assertEquals(result._tag, "Failure");
});
