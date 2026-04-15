/**
 * Tests for @corm/transpiler — verifies SCORM zip parsing and CORM transpilation.
 */
import { assertEquals, assertRejects } from "@std/assert";
import JSZip from "jszip";
import {
  parseScorm,
  transpileScorm,
  verifyScormRoundTrip,
} from "../src/index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readFixture(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

async function createScormZip(manifestXml: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("imsmanifest.xml", manifestXml);
  return await zip.generateAsync({ type: "uint8array" });
}

// ---------------------------------------------------------------------------
// SCORM 1.2 tests
// ---------------------------------------------------------------------------

Deno.test("parseScorm — SCORM 1.2 minimal fixture", async () => {
  const xml = await readFixture(
    new URL(
      "../../../fixtures/minimal-scorm12/imsmanifest.xml",
      import.meta.url,
    ).pathname,
  );
  const data = await createScormZip(xml);
  const manifest = await parseScorm(data);

  assertEquals(manifest.identifier, "com.example.fire-safety-12");
  assertEquals(manifest.version, "1.2");
  assertEquals(manifest.title, "Fire Safety Training");
  assertEquals(manifest.organizations.length, 1);
  assertEquals(manifest.organizations[0].identifier, "org-default");
  assertEquals(manifest.organizations[0].items.length, 2);
  assertEquals(manifest.organizations[0].items[0].title, "Introduction");
  assertEquals(manifest.organizations[0].items[1].title, "Fire Types");
  assertEquals(manifest.resources.length, 2);
  assertEquals(manifest.resources[0].href, "content/intro.html");
  assertEquals(manifest.defaultOrgId, "org-default");
});

Deno.test("transpileScorm — SCORM 1.2 produces valid CORM", async () => {
  const xml = await readFixture(
    new URL(
      "../../../fixtures/minimal-scorm12/imsmanifest.xml",
      import.meta.url,
    ).pathname,
  );
  const data = await createScormZip(xml);
  const corm = await transpileScorm(data);

  assertEquals(corm.corm, "1.0");
  assertEquals(corm.id, "com.example.fire-safety-12");
  assertEquals(corm.scormSource, "1.2");
  assertEquals(
    (corm.metadata as Record<string, unknown>).title,
    "Fire Safety Training",
  );

  const orgs = corm.organizations as Array<Record<string, unknown>>;
  assertEquals(orgs.length, 1);
  assertEquals(orgs[0].id, "org-default");

  const items = orgs[0].items as Array<Record<string, unknown>>;
  assertEquals(items.length, 2);
  assertEquals(items[0].title, "Introduction");
  assertEquals((items[0].content as string[])[0], "content/intro.html");
});

// ---------------------------------------------------------------------------
// SCORM 2004 tests
// ---------------------------------------------------------------------------

Deno.test("parseScorm — SCORM 2004 minimal fixture", async () => {
  const xml = await readFixture(
    new URL(
      "../../../fixtures/minimal-scorm2004/imsmanifest.xml",
      import.meta.url,
    ).pathname,
  );
  const data = await createScormZip(xml);
  const manifest = await parseScorm(data);

  assertEquals(manifest.identifier, "com.example.fire-safety-2004");
  assertEquals(manifest.version, "2004-4th");
  assertEquals(manifest.title, "Fire Safety Training");
  assertEquals(manifest.organizations.length, 1);
  assertEquals(manifest.organizations[0].items.length, 2);

  // Verify sequencing was parsed on item-01
  const item01 = manifest.organizations[0].items[0];
  assertEquals(item01.sequencing !== undefined, true);
  assertEquals(item01.sequencing!.controlMode.choice, true);
  assertEquals(item01.sequencing!.controlMode.flow, true);
  assertEquals(item01.sequencing!.objectives.length, 1);
  assertEquals(item01.sequencing!.objectives[0].primary, true);
  assertEquals(item01.sequencing!.objectives[0].id, "obj-intro");

  // Verify sequencing on item-02 (preconditions + rollup)
  const item02 = manifest.organizations[0].items[1];
  assertEquals(item02.sequencing !== undefined, true);
  assertEquals(item02.sequencing!.controlMode.forwardOnly, true);
  assertEquals(item02.sequencing!.preconditions.length, 1);
  assertEquals(item02.sequencing!.preconditions[0].action, "disabled");
  assertEquals(item02.sequencing!.rollupRules.length, 1);
});

Deno.test("transpileScorm — SCORM 2004 preserves sequencing in CORM", async () => {
  const xml = await readFixture(
    new URL(
      "../../../fixtures/minimal-scorm2004/imsmanifest.xml",
      import.meta.url,
    ).pathname,
  );
  const data = await createScormZip(xml);
  const corm = await transpileScorm(data);

  assertEquals(corm.corm, "1.0");
  assertEquals(corm.scormSource, "2004-4th");

  const orgs = corm.organizations as Array<Record<string, unknown>>;
  const items = orgs[0].items as Array<Record<string, unknown>>;
  assertEquals(items[0].sequencing !== undefined, true);
});

// ---------------------------------------------------------------------------
// Round-trip test
// ---------------------------------------------------------------------------

Deno.test("verifyScormRoundTrip — SCORM 1.2 round trips successfully", async () => {
  const xml = await readFixture(
    new URL(
      "../../../fixtures/minimal-scorm12/imsmanifest.xml",
      import.meta.url,
    ).pathname,
  );
  const data = await createScormZip(xml);
  const result = await verifyScormRoundTrip(data);

  assertEquals(result.success, true);
  assertEquals(result.differences.length, 0);
  assertEquals(result.cormManifest.corm, "1.0");
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

Deno.test("transpileScorm — rejects invalid zip data", async () => {
  const badData = new Uint8Array([0, 1, 2, 3]);
  await assertRejects(
    () => transpileScorm(badData),
    Error,
  );
});

Deno.test("transpileScorm — rejects zip without manifest", async () => {
  const zip = new JSZip();
  zip.file("readme.txt", "no manifest here");
  const data = await zip.generateAsync({ type: "uint8array" });

  await assertRejects(
    () => transpileScorm(data),
    Error,
  );
});

Deno.test("parseScorm — handles nested manifest path", async () => {
  const xml = await readFixture(
    new URL(
      "../../../fixtures/minimal-scorm12/imsmanifest.xml",
      import.meta.url,
    ).pathname,
  );
  const zip = new JSZip();
  zip.file("course/imsmanifest.xml", xml);
  const data = await zip.generateAsync({ type: "uint8array" });
  const manifest = await parseScorm(data);

  assertEquals(manifest.identifier, "com.example.fire-safety-12");
});
