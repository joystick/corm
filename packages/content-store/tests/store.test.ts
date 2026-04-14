import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { ContentStore, ContentStoreLive } from "../src/store.ts";

const runWithStore = <A>(baseDir: string, effect: Effect.Effect<A, unknown, ContentStore>) =>
  Effect.runPromise(Effect.provide(effect, ContentStoreLive(baseDir)));

describe("ContentStore", () => {
  it("stores content and returns SHA-256 hash", async () => {
    const dir = await Deno.makeTempDir();
    const data = new TextEncoder().encode("hello");
    const hash = await runWithStore(
      dir,
      Effect.gen(function* () {
        const store = yield* ContentStore;
        return yield* store.put(data);
      }),
    );
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("retrieves content by hash", async () => {
    const dir = await Deno.makeTempDir();
    const data = new TextEncoder().encode("world");
    const program = Effect.gen(function* () {
      const store = yield* ContentStore;
      const hash = yield* store.put(data);
      return yield* store.get(hash);
    });
    const retrieved = await runWithStore(dir, program);
    expect(retrieved).toEqual(data);
  });

  it("deduplicates: same content stored once", async () => {
    const dir = await Deno.makeTempDir();
    const data = new TextEncoder().encode("deduplicate me");
    const program = Effect.gen(function* () {
      const store = yield* ContentStore;
      const hash1 = yield* store.put(data);
      const hash2 = yield* store.put(data);
      return { hash1, hash2 };
    });
    const { hash1, hash2 } = await runWithStore(dir, program);
    expect(hash1).toBe(hash2);

    // Verify only one file exists under the shard dir
    const shard = hash1.slice(0, 2);
    let count = 0;
    for await (const _ of Deno.readDir(`${dir}/${shard}`)) count++;
    expect(count).toBe(1);
  });

  it("has() returns false before put, true after", async () => {
    const dir = await Deno.makeTempDir();
    const data = new TextEncoder().encode("existence check");
    const program = Effect.gen(function* () {
      const store = yield* ContentStore;
      const hash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
      const before = yield* store.has(hash);
      yield* store.put(data);
      const actualHash = yield* store.put(data);
      const after = yield* store.has(actualHash);
      return { before, after };
    });
    const { before, after } = await runWithStore(dir, program);
    expect(before).toBe(false);
    expect(after).toBe(true);
  });

  it("list() returns all stored hashes", async () => {
    const dir = await Deno.makeTempDir();
    const program = Effect.gen(function* () {
      const store = yield* ContentStore;
      const h1 = yield* store.put(new TextEncoder().encode("one"));
      const h2 = yield* store.put(new TextEncoder().encode("two"));
      const h3 = yield* store.put(new TextEncoder().encode("three"));
      const hashes = yield* store.list();
      return { h1, h2, h3, hashes };
    });
    const { h1, h2, h3, hashes } = await runWithStore(dir, program);
    expect(hashes).toHaveLength(3);
    expect(hashes).toContain(h1);
    expect(hashes).toContain(h2);
    expect(hashes).toContain(h3);
  });

  it("uses git-like sharding (first 2 chars as dir)", async () => {
    const dir = await Deno.makeTempDir();
    const data = new TextEncoder().encode("shard test");
    const hash = await runWithStore(
      dir,
      Effect.gen(function* () {
        const store = yield* ContentStore;
        return yield* store.put(data);
      }),
    );
    const shard = hash.slice(0, 2);
    const filePath = `${dir}/${shard}/${hash}`;
    const stat = await Deno.stat(filePath);
    expect(stat.isFile).toBe(true);
  });
});
