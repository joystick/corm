import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import type { ScormManifest } from "@corm/scorm-parser";
import type { ItemSequencing } from "@corm/schema";
import { scormToCorm } from "../src/mod.ts";

const testSequencing: ItemSequencing = {
  controlMode: {
    choice: true,
    choiceExit: true,
    flow: true,
    forwardOnly: false,
    useCurrentAttemptObjectiveInfo: true,
    useCurrentAttemptProgressInfo: true,
  },
  constrainChoice: false,
  preventActivation: false,
  preconditions: [],
  postconditions: [],
  exitConditions: [],
  objectives: [],
  rollupRules: [],
};

function makeManifest(): ScormManifest {
  return {
    identifier: "course-123",
    version: "2004-3rd",
    title: "Test Course",
    defaultOrgId: "org-1",
    organizations: [
      {
        identifier: "org-1",
        title: "Default Organization",
        items: [
          {
            identifier: "item-1",
            identifierref: "res-1",
            title: "Module 1",
            isVisible: true,
            parameters: "?lang=en",
            sequencing: testSequencing,
            children: [
              {
                identifier: "item-1-1",
                identifierref: "res-2",
                title: "Lesson 1.1",
                isVisible: true,
                children: [],
              },
              {
                identifier: "item-1-2",
                title: "Hidden Lesson",
                isVisible: false,
                children: [],
              },
            ],
          },
          {
            identifier: "item-2",
            identifierref: "res-3",
            title: "Module 2",
            isVisible: true,
            children: [],
          },
        ],
      },
    ],
    resources: [
      {
        identifier: "res-1",
        type: "webcontent",
        scormType: "sco",
        href: "module1/index.html",
        files: ["module1/index.html", "module1/style.css"],
      },
      {
        identifier: "res-2",
        type: "webcontent",
        scormType: "sco",
        href: "module1/lesson1.html",
        files: ["module1/lesson1.html"],
      },
      {
        identifier: "res-3",
        type: "webcontent",
        scormType: "sco",
        href: "module2/index.html",
        files: ["module2/index.html"],
      },
    ],
  };
}

Deno.test("scormToCorm maps id, version, scormSource", async () => {
  const scorm = makeManifest();
  const corm = await Effect.runPromise(scormToCorm(scorm));

  assertEquals(corm.corm, "1.0");
  assertEquals(corm.id, "course-123");
  assertEquals(corm.version, "0.1.0");
  assertEquals(corm.scormSource, "2004-3rd");
});

Deno.test("scormToCorm maps metadata title", async () => {
  const scorm = makeManifest();
  const corm = await Effect.runPromise(scormToCorm(scorm));

  assertEquals(corm.metadata.title, "Test Course");
});

Deno.test("scormToCorm maps organizations", async () => {
  const scorm = makeManifest();
  const corm = await Effect.runPromise(scormToCorm(scorm));

  assertEquals(corm.organizations.length, 1);
  assertEquals(corm.organizations[0].id, "org-1");
  assertEquals(corm.organizations[0].title, "Default Organization");
});

Deno.test("scormToCorm maps items with content hrefs", async () => {
  const scorm = makeManifest();
  const corm = await Effect.runPromise(scormToCorm(scorm));

  const items = corm.organizations[0].items;
  assertEquals(items.length, 2);

  // Module 1
  assertEquals(items[0].id, "item-1");
  assertEquals(items[0].title, "Module 1");
  assertEquals(items[0].isVisible, true);
  assertEquals(items[0].content, ["module1/index.html"]);
  assertEquals(items[0].parameters, "?lang=en");

  // Module 2
  assertEquals(items[1].id, "item-2");
  assertEquals(items[1].content, ["module2/index.html"]);
});

Deno.test("scormToCorm maps nested children as items", async () => {
  const scorm = makeManifest();
  const corm = await Effect.runPromise(scormToCorm(scorm));

  const children = corm.organizations[0].items[0].items!;
  assertEquals(children.length, 2);

  assertEquals(children[0].id, "item-1-1");
  assertEquals(children[0].title, "Lesson 1.1");
  assertEquals(children[0].content, ["module1/lesson1.html"]);

  // Hidden item
  assertEquals(children[1].id, "item-1-2");
  assertEquals(children[1].isVisible, false);
  assertEquals(children[1].content, undefined);
});

Deno.test("scormToCorm passes through sequencing", async () => {
  const scorm = makeManifest();
  const corm = await Effect.runPromise(scormToCorm(scorm));

  const seq = corm.organizations[0].items[0].sequencing!;
  assertEquals(seq.controlMode!.flow, true);
  assertEquals(seq.controlMode!.choice, true);
});

Deno.test("scormToCorm handles SCORM 1.2 version", async () => {
  const scorm = makeManifest();
  scorm.version = "1.2";
  const corm = await Effect.runPromise(scormToCorm(scorm));

  assertEquals(corm.scormSource, "1.2");
});
