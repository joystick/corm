import { assertEquals } from "@std/assert";
import { Effect, Layer } from "effect";
import {
  ScormParser,
  ScormParserLive,
} from "../../packages/scorm-parser/src/mod.ts";
import { scormToCorm } from "../../packages/lens/src/mod.ts";
import { cormToScorm } from "../../packages/lens/src/mod.ts";
import { verifyRoundTrip } from "../../packages/lens/src/mod.ts";
import {
  Validator,
  ValidatorLive,
} from "../../packages/validator/src/mod.ts";

const H2S_ZIP = "/Users/alexei/Projects/ofa/seaducate.com/public/H2SExposureSCORM.zip";

Deno.test("H2S Safety Course: parse real SCORM package", async () => {
  const data = await Deno.readFile(H2S_ZIP);

  const program = Effect.gen(function* () {
    const parser = yield* ScormParser;
    const scorm = yield* parser.parse(data);

    console.log("\n=== H2S SCORM Package ===");
    console.log(`Version:        ${scorm.version}`);
    console.log(`Identifier:     ${scorm.identifier}`);
    console.log(`Title:          ${scorm.title}`);
    console.log(`Organizations:  ${scorm.organizations.length}`);
    console.log(`Default Org:    ${scorm.defaultOrgId}`);
    console.log(`Resources:      ${scorm.resources.length}`);

    for (const org of scorm.organizations) {
      console.log(`\nOrg: ${org.identifier} — "${org.title}"`);
      const printItems = (items: typeof org.items, indent = "  ") => {
        for (const item of items) {
          const ref = item.identifierref ? ` → ${item.identifierref}` : "";
          const seq = item.sequencing ? " [seq]" : "";
          console.log(`${indent}${item.identifier}: "${item.title}"${ref}${seq}`);
          if (item.children.length > 0) {
            printItems(item.children, indent + "  ");
          }
        }
      };
      printItems(org.items);
    }

    console.log(`\nResources (first 10):`);
    for (const res of scorm.resources.slice(0, 10)) {
      console.log(`  ${res.identifier}: ${res.scormType} → ${res.href}`);
    }
    if (scorm.resources.length > 10) {
      console.log(`  ... and ${scorm.resources.length - 10} more`);
    }

    return scorm;
  }).pipe(Effect.provide(ScormParserLive));

  const scorm = await Effect.runPromise(program);
  assertEquals(typeof scorm.version, "string");
  assertEquals(scorm.organizations.length > 0, true);
});

Deno.test("H2S Safety Course: SCORM→CORM transpilation", async () => {
  const data = await Deno.readFile(H2S_ZIP);

  const program = Effect.gen(function* () {
    const parser = yield* ScormParser;
    const scorm = yield* parser.parse(data);
    const corm = yield* scormToCorm(scorm);

    console.log("\n=== CORM Output ===");
    console.log(`ID:          ${corm.id}`);
    console.log(`Version:     ${corm.version}`);
    console.log(`SCORM Src:   ${corm.scormSource}`);
    console.log(`Title:       ${corm.metadata.title}`);
    console.log(`Orgs:        ${corm.organizations.length}`);

    const json = JSON.stringify(corm);
    console.log(`JSON size:   ${new TextEncoder().encode(json).length} bytes`);
    console.log(`< 128KB?     ${new TextEncoder().encode(json).length < 131072}`);

    return corm;
  }).pipe(Effect.provide(ScormParserLive));

  const corm = await Effect.runPromise(program);
  assertEquals(typeof corm.id, "string");
  assertEquals(typeof corm.metadata.title, "string");
});

Deno.test("H2S Safety Course: validate CORM manifest", async () => {
  const data = await Deno.readFile(H2S_ZIP);

  const program = Effect.gen(function* () {
    const parser = yield* ScormParser;
    const scorm = yield* parser.parse(data);
    const corm = yield* scormToCorm(scorm);

    const validator = yield* Validator;
    const result = yield* validator.validate(corm);

    console.log("\n=== Validation ===");
    console.log(`Valid:  ${result.valid}`);
    if (!result.valid) {
      for (const err of result.errors) {
        console.log(`  [${err.rule}] ${err.message}`);
      }
    }

    return result;
  }).pipe(Effect.provide(Layer.merge(ScormParserLive, ValidatorLive)));

  const result = await Effect.runPromise(program);
  console.log(`Errors: ${result.errors.length}`);
});

Deno.test("H2S Safety Course: full round-trip verification", async () => {
  const data = await Deno.readFile(H2S_ZIP);

  const program = Effect.gen(function* () {
    const parser = yield* ScormParser;
    const scorm = yield* parser.parse(data);
    const rtResult = yield* verifyRoundTrip(scorm);

    console.log("\n=== Round-Trip ===");
    console.log(`Success:      ${rtResult.success}`);
    if (rtResult.differences.length > 0) {
      console.log(`Differences:`);
      for (const diff of rtResult.differences) {
        console.log(`  - ${diff}`);
      }
    }

    return rtResult;
  }).pipe(Effect.provide(ScormParserLive));

  const result = await Effect.runPromise(program);
  assertEquals(result.success, true, `Round-trip failed: ${result.differences.join(", ")}`);
});
