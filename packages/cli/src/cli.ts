/**
 * CORM CLI — orchestrates SCORM-to-CORM pipeline.
 *
 * Commands:
 *   convert <input.zip> [--output <dir>] [--verify] [--json]
 *   validate <manifest.json>
 *   info <input.zip>
 */
import { parseArgs } from "@std/cli/parse-args";
import { Effect, Layer } from "effect";
import { ScormParser, ScormParserLive } from "@corm/scorm-parser";
import { scormToCorm, verifyRoundTrip } from "@corm/lens";
import { Validator, ValidatorLive } from "@corm/validator";

// ---------------------------------------------------------------------------
// Pipeline functions (exported for programmatic use)
// ---------------------------------------------------------------------------

/**
 * Parse a SCORM zip buffer into a ScormManifest.
 */
export function parseScormZip(data: Uint8Array) {
  return Effect.gen(function* () {
    const parser = yield* ScormParser;
    return yield* parser.parse(data);
  });
}

/**
 * Full convert pipeline: parse SCORM zip -> transpile to CORM manifest.
 */
export function convertPipeline(
  data: Uint8Array,
  options: { verify?: boolean } = {},
) {
  return Effect.gen(function* () {
    const parser = yield* ScormParser;
    const scormManifest = yield* parser.parse(data);
    const cormManifest = yield* scormToCorm(scormManifest);

    let roundTripResult = undefined;
    if (options.verify) {
      roundTripResult = yield* verifyRoundTrip(scormManifest);
    }

    return { cormManifest, scormManifest, roundTripResult };
  });
}

/**
 * Info pipeline: parse and return summary.
 */
export function infoPipeline(data: Uint8Array) {
  return Effect.gen(function* () {
    const parser = yield* ScormParser;
    const manifest = yield* parser.parse(data);

    let itemCount = 0;
    function countItems(
      items: readonly { children: readonly unknown[] }[],
    ): void {
      for (const item of items) {
        itemCount++;
        countItems(
          item.children as readonly { children: readonly unknown[] }[],
        );
      }
    }
    for (const org of manifest.organizations) {
      countItems(org.items);
    }

    return {
      version: manifest.version,
      title: manifest.title,
      identifier: manifest.identifier,
      organizationCount: manifest.organizations.length,
      itemCount,
      resourceCount: manifest.resources.length,
    };
  });
}

/**
 * Validate pipeline: validate a CORM manifest object.
 */
export function validatePipeline(manifest: unknown) {
  return Effect.gen(function* () {
    const validator = yield* Validator;
    return yield* validator.validate(manifest);
  });
}

// ---------------------------------------------------------------------------
// Layer combining all services
// ---------------------------------------------------------------------------

const MainLive = Layer.mergeAll(ScormParserLive, ValidatorLive);

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`Usage:
  corm convert <input.zip> [--output <dir>] [--verify] [--json]
  corm validate <manifest.json>
  corm info <input.zip>

Commands:
  convert    Parse a SCORM zip and produce a CORM manifest
  validate   Validate a CORM manifest JSON file
  info       Quick inspection of a SCORM zip package

Options:
  --output   Output directory (default: ./<input-name>/)
  --verify   Run round-trip verification after conversion
  --json     Print manifest to stdout instead of writing file`);
}

async function runConvert(
  inputPath: string,
  options: { output?: string; verify?: boolean; json?: boolean },
): Promise<void> {
  const data = await Deno.readFile(inputPath);

  const program = convertPipeline(data, { verify: options.verify }).pipe(
    Effect.provide(MainLive),
    Effect.catchAll((error) =>
      Effect.die(`Convert failed: ${error.message ?? String(error)}`)
    ),
  );

  const result = await Effect.runPromise(program);
  const jsonStr = JSON.stringify(result.cormManifest, null, 2);

  if (options.json) {
    console.log(jsonStr);
  } else {
    const baseName = inputPath.replace(/\.zip$/i, "").split("/").pop() ??
      "output";
    const outputDir = options.output ?? `./${baseName}`;
    await Deno.mkdir(outputDir, { recursive: true });
    const outputPath = `${outputDir}/manifest.json`;
    await Deno.writeTextFile(outputPath, jsonStr + "\n");
    console.log(`CORM manifest written to ${outputPath}`);
  }

  if (result.roundTripResult) {
    const rt = result.roundTripResult;
    if (rt.success) {
      console.log("Round-trip verification: PASSED");
    } else {
      console.log("Round-trip verification: FAILED");
      for (const diff of rt.differences) {
        console.log(`  - ${diff}`);
      }
    }
  }
}

async function runInfo(inputPath: string): Promise<void> {
  const data = await Deno.readFile(inputPath);

  const program = infoPipeline(data).pipe(
    Effect.provide(MainLive),
    Effect.catchAll((error) =>
      Effect.die(`Info failed: ${error.message ?? String(error)}`)
    ),
  );

  const info = await Effect.runPromise(program);
  console.log(`SCORM Package: ${inputPath}`);
  console.log(`  Version:       ${info.version}`);
  console.log(`  Title:         ${info.title}`);
  console.log(`  Identifier:    ${info.identifier}`);
  console.log(`  Organizations: ${info.organizationCount}`);
  console.log(`  Items:         ${info.itemCount}`);
  console.log(`  Resources:     ${info.resourceCount}`);
}

async function runValidate(inputPath: string): Promise<void> {
  const text = await Deno.readTextFile(inputPath);
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    console.error(`Error: Failed to parse ${inputPath} as JSON`);
    Deno.exit(1);
  }

  const program = validatePipeline(manifest).pipe(
    Effect.provide(MainLive),
  );

  const result = await Effect.runPromise(program);
  if (result.valid) {
    console.log("Validation: PASSED");
  } else {
    console.log("Validation: FAILED");
    for (const err of result.errors) {
      const path = err.path ? ` (${err.path})` : "";
      console.log(`  [${err.rule}]${path}: ${err.message}`);
    }
    Deno.exit(1);
  }
}

/**
 * Main CLI entry point. Parse args and dispatch to the appropriate command.
 */
export async function main(args: string[] = Deno.args): Promise<void> {
  const parsed = parseArgs(args, {
    string: ["output"],
    boolean: ["verify", "json", "help"],
    alias: { o: "output", h: "help" },
  });

  const command = parsed._[0] as string | undefined;
  const target = parsed._[1] as string | undefined;

  if (parsed.help || !command) {
    printUsage();
    return;
  }

  if (!target) {
    console.error(`Error: Missing argument for '${command}' command.`);
    printUsage();
    Deno.exit(1);
  }

  switch (command) {
    case "convert":
      await runConvert(target, {
        output: parsed.output,
        verify: parsed.verify,
        json: parsed.json,
      });
      break;
    case "info":
      await runInfo(target);
      break;
    case "validate":
      await runValidate(target);
      break;
    default:
      console.error(`Error: Unknown command '${command}'`);
      printUsage();
      Deno.exit(1);
  }
}
