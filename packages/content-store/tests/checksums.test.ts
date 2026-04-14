import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { computeChecksums, diffChecksums } from "../src/checksums.ts";

describe("computeChecksums", () => {
  it("computes SHA-256 for each file", async () => {
    const files = new Map<string, Uint8Array>([
      ["hello.md", new TextEncoder().encode("hello")],
      ["world.md", new TextEncoder().encode("world")],
    ]);
    const checksums = await Effect.runPromise(computeChecksums(files, "1.0.0"));
    expect(checksums.version).toBe("1.0.0");
    expect(checksums.previousVersion).toBeUndefined();
    expect(checksums.files["hello.md"]).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(checksums.files["world.md"]).toHaveLength(64);
  });

  it("sets previousVersion when provided", async () => {
    const files = new Map<string, Uint8Array>([["a.md", new TextEncoder().encode("a")]]);
    const checksums = await Effect.runPromise(computeChecksums(files, "2.0.0", "1.0.0"));
    expect(checksums.version).toBe("2.0.0");
    expect(checksums.previousVersion).toBe("1.0.0");
  });

  it("handles empty file map", async () => {
    const checksums = await Effect.runPromise(
      computeChecksums(new Map(), "1.0.0"),
    );
    expect(Object.keys(checksums.files)).toHaveLength(0);
  });
});

describe("diffChecksums", () => {
  const enc = (s: string) => new TextEncoder().encode(s);

  it("identifies added files", async () => {
    const old_ = await Effect.runPromise(
      computeChecksums(new Map([["a.md", enc("a")]]), "1.0.0"),
    );
    const new_ = await Effect.runPromise(
      computeChecksums(new Map([["a.md", enc("a")], ["b.md", enc("b")]]), "2.0.0"),
    );
    const diff = diffChecksums(old_, new_);
    expect(diff.added).toContain("b.md");
    expect(diff.unchanged).toContain("a.md");
    expect(diff.changed).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it("identifies removed files", async () => {
    const old_ = await Effect.runPromise(
      computeChecksums(new Map([["a.md", enc("a")], ["b.md", enc("b")]]), "1.0.0"),
    );
    const new_ = await Effect.runPromise(
      computeChecksums(new Map([["a.md", enc("a")]]), "2.0.0"),
    );
    const diff = diffChecksums(old_, new_);
    expect(diff.removed).toContain("b.md");
    expect(diff.unchanged).toContain("a.md");
    expect(diff.added).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it("identifies changed files", async () => {
    const old_ = await Effect.runPromise(
      computeChecksums(new Map([["a.md", enc("original")]]), "1.0.0"),
    );
    const new_ = await Effect.runPromise(
      computeChecksums(new Map([["a.md", enc("modified")]]), "2.0.0"),
    );
    const diff = diffChecksums(old_, new_);
    expect(diff.changed).toContain("a.md");
    expect(diff.unchanged).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it("identifies unchanged files", async () => {
    const files = new Map([["a.md", enc("same")]]);
    const old_ = await Effect.runPromise(computeChecksums(files, "1.0.0"));
    const new_ = await Effect.runPromise(computeChecksums(files, "2.0.0"));
    const diff = diffChecksums(old_, new_);
    expect(diff.unchanged).toContain("a.md");
    expect(diff.added).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });
});
