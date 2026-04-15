import { assertEquals } from "@std/assert";
import { transpileScorm, parseScorm, verifyScormRoundTrip } from "../src/index.ts";

const H2S_ZIP =
  "/Users/alexei/Projects/ofa/seaducate.com/public/H2SExposureSCORM.zip";

Deno.test("H2S real course: parseScorm", async () => {
  const data = await Deno.readFile(H2S_ZIP);
  const scorm = await parseScorm(data);
  assertEquals(scorm.version, "1.2");
  assertEquals(scorm.title, "H2S Exposure - ORIGINAL SCORM");
  assertEquals(scorm.organizations.length, 1);
  assertEquals(scorm.resources.length, 1);
  assertEquals(scorm.resources[0].scormType, "sco");
});

Deno.test("H2S real course: transpileScorm", async () => {
  const data = await Deno.readFile(H2S_ZIP);
  const corm = await transpileScorm(data);
  assertEquals(corm.id, "_5fTL2NifIiM");
  assertEquals(corm.scormSource, "1.2");
  assertEquals((corm.metadata as { title: string }).title, "H2S Exposure - ORIGINAL SCORM");

  const json = JSON.stringify(corm);
  console.log(`CORM manifest size: ${new TextEncoder().encode(json).length} bytes`);
});

Deno.test("H2S real course: round-trip", async () => {
  const data = await Deno.readFile(H2S_ZIP);
  const result = await verifyScormRoundTrip(data);
  assertEquals(result.success, true, `Differences: ${result.differences.join(", ")}`);
});
