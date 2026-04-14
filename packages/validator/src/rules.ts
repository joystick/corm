import { Effect, Schema } from "effect";
import { Manifest } from "@corm/schema";
import { ValidationError } from "./errors.ts";

const DEFAULT_MAX_BYTES = 131_072; // 128 KB

export const validatePacketSize = (
  data: Uint8Array | string,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Effect.Effect<void, ValidationError> =>
  Effect.gen(function* () {
    const byteLength = typeof data === "string"
      ? new TextEncoder().encode(data).byteLength
      : data.byteLength;

    if (byteLength > maxBytes) {
      return yield* new ValidationError({
        message:
          `Packet size ${byteLength} bytes exceeds maximum of ${maxBytes} bytes`,
        rule: "packet-size",
      });
    }
  });

export const validateManifestSchema = (
  manifest: unknown,
): Effect.Effect<void, ValidationError> =>
  Schema.decodeUnknown(Manifest)(manifest).pipe(
    Effect.map(() => void 0),
    Effect.mapError((e) =>
      new ValidationError({
        message: `Schema validation failed: ${e.message}`,
        rule: "manifest-schema",
      })
    ),
  );

export const validateRequiredFields = (
  manifest: Record<string, unknown>,
): Effect.Effect<void, ValidationError> =>
  Effect.gen(function* () {
    if (typeof manifest.id !== "string" || manifest.id.trim() === "") {
      return yield* new ValidationError({
        message: "Field 'id' is required and must be a non-empty string",
        path: "id",
        rule: "required-fields",
      });
    }

    if (
      typeof manifest.version !== "string" || manifest.version.trim() === ""
    ) {
      return yield* new ValidationError({
        message: "Field 'version' is required and must be a non-empty string",
        path: "version",
        rule: "required-fields",
      });
    }

    const metadata = manifest.metadata as Record<string, unknown> | undefined;
    if (
      !metadata ||
      typeof metadata.title !== "string" ||
      metadata.title.trim() === ""
    ) {
      return yield* new ValidationError({
        message:
          "Field 'metadata.title' is required and must be a non-empty string",
        path: "metadata.title",
        rule: "required-fields",
      });
    }
  });

export const validateOrganizationStructure = (
  manifest: Record<string, unknown>,
): Effect.Effect<void, ValidationError> =>
  Effect.gen(function* () {
    const orgs = manifest.organizations;
    if (!Array.isArray(orgs) || orgs.length === 0) {
      return yield* new ValidationError({
        message: "Organizations array must be non-empty",
        path: "organizations",
        rule: "organization-structure",
      });
    }

    for (let i = 0; i < orgs.length; i++) {
      const org = orgs[i] as Record<string, unknown>;
      const items = org.items;
      if (!Array.isArray(items) || items.length === 0) {
        return yield* new ValidationError({
          message: `Organization at index ${i} must have at least one item`,
          path: `organizations[${i}].items`,
          rule: "organization-structure",
        });
      }
    }
  });

export const validateResourceReferences = (
  manifest: Record<string, unknown>,
): Effect.Effect<void, ValidationError> =>
  Effect.gen(function* () {
    const orgs = manifest.organizations;
    if (!Array.isArray(orgs)) return;

    for (let i = 0; i < orgs.length; i++) {
      const org = orgs[i] as Record<string, unknown>;
      const items = org.items;
      if (!Array.isArray(items)) continue;

      for (let j = 0; j < items.length; j++) {
        const item = items[j] as Record<string, unknown>;
        const content = item.content;
        if (content !== undefined) {
          if (!Array.isArray(content)) {
            return yield* new ValidationError({
              message:
                `Item content must be an array of non-empty strings when present`,
              path: `organizations[${i}].items[${j}].content`,
              rule: "resource-references",
            });
          }
          for (let k = 0; k < content.length; k++) {
            if (typeof content[k] !== "string" || content[k].trim() === "") {
              return yield* new ValidationError({
                message: `Content reference must be a non-empty string`,
                path: `organizations[${i}].items[${j}].content[${k}]`,
                rule: "resource-references",
              });
            }
          }
        }
      }
    }
  });
