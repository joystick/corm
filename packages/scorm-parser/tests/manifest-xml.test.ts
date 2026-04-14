import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import { parseManifestXml } from "../src/manifest-xml.ts";

const FIXTURES_DIR = new URL("../../../fixtures", import.meta.url).pathname;

Deno.test("parseManifestXml: SCORM 1.2 — parses organizations and resources", async () => {
  const xml = await Deno.readTextFile(
    `${FIXTURES_DIR}/minimal-scorm12/imsmanifest.xml`,
  );
  const manifest = await Effect.runPromise(parseManifestXml(xml, "1.2"));

  assertEquals(manifest.version, "1.2");
  assertEquals(manifest.title, "Fire Safety Training");
  assertEquals(manifest.organizations.length, 1);
  assertEquals(manifest.organizations[0].items.length, 2);
  assertEquals(manifest.organizations[0].items[0].title, "Introduction");
  assertEquals(manifest.organizations[0].items[0].identifier, "item-01");
  assertEquals(manifest.organizations[0].items[0].identifierref, "res-01");
  assertEquals(manifest.organizations[0].items[1].title, "Fire Types");
  assertEquals(manifest.resources.length, 2);
  assertEquals(manifest.resources[0].identifier, "res-01");
  assertEquals(manifest.resources[0].href, "content/intro.html");
  assertEquals(manifest.resources[1].identifier, "res-02");
  assertEquals(manifest.resources[1].href, "content/fire-types.html");
  // SCORM 1.2 items should NOT have sequencing
  assertEquals(manifest.organizations[0].items[0].sequencing, undefined);
});

Deno.test("parseManifestXml: SCORM 2004 — parses sequencing with objectives", async () => {
  const xml = await Deno.readTextFile(
    `${FIXTURES_DIR}/minimal-scorm2004/imsmanifest.xml`,
  );
  const manifest = await Effect.runPromise(parseManifestXml(xml, "2004-4th"));

  assertEquals(manifest.version, "2004-4th");
  assertEquals(manifest.title, "Fire Safety Training");
  assertEquals(manifest.organizations.length, 1);

  const items = manifest.organizations[0].items;
  assertEquals(items.length, 2);

  // Item 1: has sequencing with objectives
  const item1 = items[0];
  assertEquals(item1.title, "Introduction");
  const seq1 = item1.sequencing;
  assertEquals(seq1 !== undefined, true);
  assertEquals(seq1!.controlMode.choice, true);
  assertEquals(seq1!.controlMode.flow, true);
  assertEquals(seq1!.objectives.length, 1);
  assertEquals(seq1!.objectives[0].id, "obj-intro");
  assertEquals(seq1!.objectives[0].primary, true);
  assertEquals(seq1!.objectives[0].satisfiedByMeasure, true);
  assertEquals(seq1!.objectives[0].minNormalizedMeasure, 0.8);

  // Item 2: has sequencing with preconditions and rollup rules
  const item2 = items[1];
  assertEquals(item2.title, "Fire Types");
  const seq2 = item2.sequencing;
  assertEquals(seq2 !== undefined, true);
  assertEquals(seq2!.controlMode.forwardOnly, true);

  // Precondition rules
  assertEquals(seq2!.preconditions.length, 1);
  assertEquals(seq2!.preconditions[0].action, "disabled");
  assertEquals(seq2!.preconditions[0].conditions.operator, "all");
  assertEquals(seq2!.preconditions[0].conditions.rules.length, 1);
  assertEquals(
    seq2!.preconditions[0].conditions.rules[0].condition,
    "satisfied",
  );
  assertEquals(
    seq2!.preconditions[0].conditions.rules[0].refObjective,
    "obj-intro",
  );

  // Rollup rules
  assertEquals(seq2!.rollupRules.length, 1);
  assertEquals(seq2!.rollupRules[0].childActivitySet, "all");
  assertEquals(seq2!.rollupRules[0].action, "satisfied");
  assertEquals(seq2!.rollupRules[0].conditions.length, 1);
  assertEquals(seq2!.rollupRules[0].conditions[0].condition, "satisfied");

  // Resources
  assertEquals(manifest.resources.length, 2);
  assertEquals(manifest.resources[0].scormType, "sco");
});
