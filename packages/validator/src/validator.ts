import { Context, Effect, Layer } from "effect";
import type { ValidationError } from "./errors.ts";
import {
  validateManifestSchema,
  validateOrganizationStructure,
  validatePacketSize as validatePacketSizeRule,
  validateRequiredFields,
  validateResourceReferences,
} from "./rules.ts";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<{
    readonly message: string;
    readonly path?: string;
    readonly rule: string;
  }>;
}

export interface ValidatorService {
  validate(manifest: unknown): Effect.Effect<ValidationResult, never>;
  validatePacketSize(
    data: Uint8Array | string,
    maxBytes?: number,
  ): Effect.Effect<ValidationResult, never>;
}

export class Validator extends Context.Tag("Validator")<
  Validator,
  ValidatorService
>() {}

const collectError = (
  effect: Effect.Effect<void, ValidationError>,
): Effect.Effect<ValidationError[], never> =>
  effect.pipe(
    Effect.map(() => [] as ValidationError[]),
    Effect.catchAll((e) => Effect.succeed([e])),
  );

const makeValidatorService = (): ValidatorService => ({
  validate(manifest: unknown): Effect.Effect<ValidationResult, never> {
    return Effect.gen(function* () {
      const record = manifest as Record<string, unknown>;

      const results = yield* Effect.all([
        collectError(validateManifestSchema(manifest)),
        collectError(validateRequiredFields(record)),
        collectError(validateOrganizationStructure(record)),
        collectError(validateResourceReferences(record)),
      ], { concurrency: "unbounded" });

      const errors = results.flat();
      return {
        valid: errors.length === 0,
        errors: errors.map((e) => ({
          message: e.message,
          path: e.path,
          rule: e.rule,
        })),
      };
    });
  },

  validatePacketSize(
    data: Uint8Array | string,
    maxBytes?: number,
  ): Effect.Effect<ValidationResult, never> {
    return collectError(validatePacketSizeRule(data, maxBytes)).pipe(
      Effect.map((errors) => ({
        valid: errors.length === 0,
        errors: errors.map((e) => ({
          message: e.message,
          path: e.path,
          rule: e.rule,
        })),
      })),
    );
  },
});

export const ValidatorLive: Layer.Layer<Validator> = Layer.succeed(
  Validator,
  makeValidatorService(),
);
