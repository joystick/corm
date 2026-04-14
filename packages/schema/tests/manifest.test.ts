import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Schema } from "effect";
import { Manifest, Organization, Item } from "../src/manifest.ts";

describe("Item", () => {
  it("decodes a leaf item with content", () => {
    const input = {
      id: "mod-01",
      title: "Introduction",
      isVisible: true,
      content: ["slide-001.md", "slide-002.md"],
      sequencing: {
        controlMode: { choice: true, flow: true },
        objectives: [{ id: "obj-01", primary: true }],
      },
    };
    const result = Schema.decodeUnknownSync(Item)(input);
    expect(result.id).toBe("mod-01");
    expect(result.content).toHaveLength(2);
  });

  it("decodes a nested item with children", () => {
    const input = {
      id: "unit-01",
      title: "Unit 1",
      items: [
        { id: "mod-01", title: "Module 1", content: ["slide-001.md"] },
        { id: "mod-02", title: "Module 2", content: ["slide-002.md"] },
      ],
    };
    const result = Schema.decodeUnknownSync(Item)(input);
    expect(result.items).toHaveLength(2);
  });
});

describe("Manifest", () => {
  it("decodes a minimal manifest", () => {
    const input = {
      corm: "1.0",
      id: "com.example.fire-safety",
      version: "1.0.0",
      scormSource: "2004-4th",
      metadata: { title: "Fire Safety" },
      organizations: [
        {
          id: "org-default",
          title: "Fire Safety Training",
          items: [{ id: "mod-01", title: "Introduction" }],
        },
      ],
    };
    const result = Schema.decodeUnknownSync(Manifest)(input);
    expect(result.corm).toBe("1.0");
    expect(result.id).toBe("com.example.fire-safety");
    expect(result.organizations).toHaveLength(1);
  });
});
