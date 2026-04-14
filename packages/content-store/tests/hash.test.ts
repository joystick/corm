import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { sha256 } from "../src/hash.ts";

describe("sha256", () => {
  it("produces correct hash for known input", async () => {
    const data = new TextEncoder().encode("hello");
    const hash = await Effect.runPromise(sha256(data));
    expect(hash).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await Effect.runPromise(sha256(new TextEncoder().encode("foo")));
    const hash2 = await Effect.runPromise(sha256(new TextEncoder().encode("bar")));
    expect(hash1).not.toBe(hash2);
  });

  it("produces same hash for same input", async () => {
    const data = new TextEncoder().encode("deterministic");
    const hash1 = await Effect.runPromise(sha256(data));
    const hash2 = await Effect.runPromise(sha256(data));
    expect(hash1).toBe(hash2);
  });

  it("returns a 64-character hex string", async () => {
    const hash = await Effect.runPromise(sha256(new TextEncoder().encode("test")));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});
