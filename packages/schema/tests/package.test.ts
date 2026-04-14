import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Schema } from "effect";
import { CormPackage } from "../src/package.ts";

describe("CormPackage", () => {
  it("decodes a minimal package", () => {
    const input = {
      manifest: {
        corm: "1.0",
        id: "test",
        version: "1.0.0",
        scormSource: "2004-4th",
        metadata: { title: "Test" },
        organizations: [{ id: "org-1", title: "Org", items: [{ id: "i1", title: "Item" }] }],
      },
      modules: [{ id: "main", slides: [{ id: "s1", title: "Slide 1", body: "# Hello", assets: [] }] }],
      checksums: { version: "1.0.0", files: {} },
    };
    const result = Schema.decodeUnknownSync(CormPackage)(input);
    expect(result.manifest.id).toBe("test");
    expect(result.modules).toHaveLength(1);
  });
});
