import { Context, Effect, Layer } from "effect";
import { sha256 } from "./hash.ts";

export class ContentStore extends Context.Tag("ContentStore")<
  ContentStore,
  {
    readonly put: (data: Uint8Array) => Effect.Effect<string>;
    readonly get: (hash: string) => Effect.Effect<Uint8Array>;
    readonly has: (hash: string) => Effect.Effect<boolean>;
    readonly list: () => Effect.Effect<string[]>;
  }
>() {}

export const ContentStoreLive = (baseDir: string) =>
  Layer.succeed(ContentStore, {
    put: (data: Uint8Array) =>
      Effect.gen(function* () {
        const hash = yield* sha256(data);
        const shard = hash.slice(0, 2);
        const shardDir = `${baseDir}/${shard}`;
        const filePath = `${shardDir}/${hash}`;

        // Check if already stored (dedup)
        const exists = yield* Effect.promise(() =>
          Deno.stat(filePath).then(() => true).catch(() => false)
        );

        if (!exists) {
          yield* Effect.promise(() =>
            Deno.mkdir(shardDir, { recursive: true })
          );
          yield* Effect.promise(() => Deno.writeFile(filePath, data));
        }

        return hash;
      }),

    get: (hash: string) =>
      Effect.promise(() => {
        const shard = hash.slice(0, 2);
        const filePath = `${baseDir}/${shard}/${hash}`;
        return Deno.readFile(filePath);
      }),

    has: (hash: string) =>
      Effect.promise(() => {
        const shard = hash.slice(0, 2);
        const filePath = `${baseDir}/${shard}/${hash}`;
        return Deno.stat(filePath).then(() => true).catch(() => false);
      }),

    list: () =>
      Effect.promise(async () => {
        const hashes: string[] = [];
        for await (const shardEntry of Deno.readDir(baseDir)) {
          if (!shardEntry.isDirectory) continue;
          const shardPath = `${baseDir}/${shardEntry.name}`;
          for await (const fileEntry of Deno.readDir(shardPath)) {
            if (fileEntry.isFile) {
              hashes.push(fileEntry.name);
            }
          }
        }
        return hashes;
      }),
  });
