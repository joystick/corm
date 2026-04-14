import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import type { Manifest } from "@corm/schema";
import type { ItemSequencing } from "@corm/schema";
import { cormToScorm } from "../src/mod.ts";

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

function makeCormManifest(): Manifest {
  return {
    corm: "1.0",
    id: "course-123",
    version: "0.1.0",
    scormSource: "2004-3rd",
    metadata: {
      title: "Test Course",
    },
    organizations: [
      {
        id: "org-1",
        title: "Default Organization",
        items: [
          {
            id: "item-1",
            title: "Module 1",
            isVisible: true,
            parameters: "?lang=en",
            content: ["module1/index.html"],
            sequencing: testSequencing,
            items: [
              {
                id: "item-1-1",
                title: "Lesson 1.1",
                isVisible: true,
                content: ["module1/lesson1.html"],
              },
              {
                id: "item-1-2",
                title: "Hidden Lesson",
                isVisible: false,
              },
            ],
          },
          {
            id: "item-2",
            title: "Module 2",
            isVisible: true,
            content: ["module2/index.html"],
          },
        ],
      },
    ],
  } as Manifest;
}

Deno.test("cormToScorm maps identifier, version, title", async () => {
  const corm = makeCormManifest();
  const scorm = await Effect.runPromise(cormToScorm(corm));

  assertEquals(scorm.identifier, "course-123");
  assertEquals(scorm.version, "2004-3rd");
  assertEquals(scorm.title, "Test Course");
});

Deno.test("cormToScorm maps defaultOrgId from first org", async () => {
  const corm = makeCormManifest();
  const scorm = await Effect.runPromise(cormToScorm(corm));

  assertEquals(scorm.defaultOrgId, "org-1");
});

Deno.test("cormToScorm maps organizations", async () => {
  const corm = makeCormManifest();
  const scorm = await Effect.runPromise(cormToScorm(corm));

  assertEquals(scorm.organizations.length, 1);
  assertEquals(scorm.organizations[0].identifier, "org-1");
  assertEquals(scorm.organizations[0].title, "Default Organization");
});

Deno.test("cormToScorm maps items with identifierref", async () => {
  const corm = makeCormManifest();
  const scorm = await Effect.runPromise(cormToScorm(corm));

  const items = scorm.organizations[0].items;
  assertEquals(items.length, 2);

  assertEquals(items[0].identifier, "item-1");
  assertEquals(items[0].title, "Module 1");
  assertEquals(items[0].isVisible, true);
  assertEquals(items[0].identifierref, "res-item-1");
  assertEquals(items[0].parameters, "?lang=en");

  assertEquals(items[1].identifier, "item-2");
  assertEquals(items[1].identifierref, "res-item-2");
});

Deno.test("cormToScorm maps nested children", async () => {
  const corm = makeCormManifest();
  const scorm = await Effect.runPromise(cormToScorm(corm));

  const children = scorm.organizations[0].items[0].children;
  assertEquals(children.length, 2);

  assertEquals(children[0].identifier, "item-1-1");
  assertEquals(children[0].identifierref, "res-item-1-1");

  // Hidden item with no content
  assertEquals(children[1].identifier, "item-1-2");
  assertEquals(children[1].isVisible, false);
  assertEquals(children[1].identifierref, undefined);
});

Deno.test("cormToScorm generates resources for items with content", async () => {
  const corm = makeCormManifest();
  const scorm = await Effect.runPromise(cormToScorm(corm));

  // 3 items have content: item-1, item-1-1, item-2
  assertEquals(scorm.resources.length, 3);

  const res1 = scorm.resources.find((r) => r.identifier === "res-item-1");
  assertEquals(res1?.type, "webcontent");
  assertEquals(res1?.scormType, "sco");
  assertEquals(res1?.href, "module1/index.html");
  assertEquals(res1?.files, ["module1/index.html"]);
});

Deno.test("cormToScorm passes through sequencing", async () => {
  const corm = makeCormManifest();
  const scorm = await Effect.runPromise(cormToScorm(corm));

  const seq = scorm.organizations[0].items[0].sequencing!;
  assertEquals(seq.controlMode!.flow, true);
  assertEquals(seq.controlMode!.choice, true);
});
