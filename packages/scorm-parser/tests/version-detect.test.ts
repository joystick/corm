import { assertEquals, assertRejects } from "@std/assert";
import { Effect } from "effect";
import { detectVersion } from "../src/version-detect.ts";

Deno.test("detectVersion: SCORM 1.2", async () => {
  const xml = `<?xml version="1.0"?>
    <manifest><metadata><schemaversion>1.2</schemaversion></metadata></manifest>`;
  const result = await Effect.runPromise(detectVersion(xml));
  assertEquals(result, "1.2");
});

Deno.test("detectVersion: SCORM 2004 4th Edition", async () => {
  const xml = `<?xml version="1.0"?>
    <manifest><metadata><schemaversion>2004 4th Edition</schemaversion></metadata></manifest>`;
  const result = await Effect.runPromise(detectVersion(xml));
  assertEquals(result, "2004-4th");
});

Deno.test("detectVersion: SCORM 2004 3rd Edition", async () => {
  const xml = `<?xml version="1.0"?>
    <manifest><metadata><schemaversion>2004 3rd Edition</schemaversion></metadata></manifest>`;
  const result = await Effect.runPromise(detectVersion(xml));
  assertEquals(result, "2004-3rd");
});

Deno.test("detectVersion: SCORM 2004 2nd Edition", async () => {
  const xml = `<?xml version="1.0"?>
    <manifest><metadata><schemaversion>2004 2nd Edition</schemaversion></metadata></manifest>`;
  const result = await Effect.runPromise(detectVersion(xml));
  assertEquals(result, "2004-2nd");
});

Deno.test("detectVersion: namespace fallback for 1.2", async () => {
  const xml = `<?xml version="1.0"?>
    <manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
      <metadata><schema>ADL SCORM</schema></metadata>
    </manifest>`;
  const result = await Effect.runPromise(detectVersion(xml));
  assertEquals(result, "1.2");
});

Deno.test("detectVersion: namespace fallback for 2004", async () => {
  const xml = `<?xml version="1.0"?>
    <manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
      <metadata><schema>ADL SCORM</schema></metadata>
    </manifest>`;
  const result = await Effect.runPromise(detectVersion(xml));
  assertEquals(result, "2004-4th");
});

Deno.test("detectVersion: unknown version fails", async () => {
  const xml = `<?xml version="1.0"?>
    <manifest><metadata><schemaversion>99.99</schemaversion></metadata></manifest>`;
  await assertRejects(
    () => Effect.runPromise(detectVersion(xml)),
    Error,
    "Unsupported SCORM version",
  );
});
