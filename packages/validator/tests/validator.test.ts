import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import {
  validatePacketSize,
  validateRequiredFields,
  Validator,
  ValidatorLive,
} from "../src/mod.ts";

const validManifest = {
  corm: "1.0" as const,
  id: "test-course-001",
  version: "1.0.0",
  scormSource: "2004-4th" as const,
  metadata: {
    title: "Test Course",
    schema: "LOM",
  },
  organizations: [
    {
      id: "org-1",
      title: "Default Organization",
      items: [
        {
          id: "item-1",
          title: "Module 1",
          content: ["slide-1.md"],
        },
      ],
    },
  ],
};

Deno.test("valid manifest passes all checks", async () => {
  const program = Effect.gen(function* () {
    const validator = yield* Validator;
    return yield* validator.validate(validManifest);
  }).pipe(Effect.provide(ValidatorLive));

  const result = await Effect.runPromise(program);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("missing id field produces required-fields error", async () => {
  const manifest = { ...validManifest, id: "" };
  const program = Effect.gen(function* () {
    const validator = yield* Validator;
    return yield* validator.validate(manifest);
  }).pipe(Effect.provide(ValidatorLive));

  const result = await Effect.runPromise(program);
  assertEquals(result.valid, false);
  const reqError = result.errors.find((e) => e.rule === "required-fields");
  assertEquals(reqError !== undefined, true);
  assertEquals(reqError!.path, "id");
});

Deno.test("empty organizations produces organization-structure error", async () => {
  const manifest = { ...validManifest, organizations: [] };
  const program = Effect.gen(function* () {
    const validator = yield* Validator;
    return yield* validator.validate(manifest);
  }).pipe(Effect.provide(ValidatorLive));

  const result = await Effect.runPromise(program);
  assertEquals(result.valid, false);
  const orgError = result.errors.find(
    (e) => e.rule === "organization-structure",
  );
  assertEquals(orgError !== undefined, true);
});

Deno.test("oversized packet produces packet-size error", async () => {
  const bigData = "x".repeat(200_000);
  const program = Effect.gen(function* () {
    const validator = yield* Validator;
    return yield* validator.validatePacketSize(bigData);
  }).pipe(Effect.provide(ValidatorLive));

  const result = await Effect.runPromise(program);
  assertEquals(result.valid, false);
  const sizeError = result.errors.find((e) => e.rule === "packet-size");
  assertEquals(sizeError !== undefined, true);
});

Deno.test("under-size packet passes", async () => {
  const smallData = "hello";
  const program = Effect.gen(function* () {
    const validator = yield* Validator;
    return yield* validator.validatePacketSize(smallData);
  }).pipe(Effect.provide(ValidatorLive));

  const result = await Effect.runPromise(program);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("schema validation catches wrong types", async () => {
  const badManifest = { ...validManifest, corm: "99.0" };
  const program = Effect.gen(function* () {
    const validator = yield* Validator;
    return yield* validator.validate(badManifest);
  }).pipe(Effect.provide(ValidatorLive));

  const result = await Effect.runPromise(program);
  assertEquals(result.valid, false);
  const schemaError = result.errors.find((e) => e.rule === "manifest-schema");
  assertEquals(schemaError !== undefined, true);
});

Deno.test("validatePacketSize rule works directly with Uint8Array", async () => {
  const data = new Uint8Array(200_000);
  const result = await Effect.runPromise(
    validatePacketSize(data).pipe(
      Effect.map(() => "ok" as const),
      Effect.catchAll((e) => Effect.succeed(e.rule)),
    ),
  );
  assertEquals(result, "packet-size");
});

Deno.test("validateRequiredFields catches missing metadata.title", async () => {
  const manifest = { ...validManifest, metadata: {} };
  const result = await Effect.runPromise(
    validateRequiredFields(manifest as Record<string, unknown>).pipe(
      Effect.map(() => null),
      Effect.catchAll((e) => Effect.succeed(e)),
    ),
  );
  assertEquals(result !== null, true);
  assertEquals(result!.rule, "required-fields");
  assertEquals(result!.path, "metadata.title");
});
