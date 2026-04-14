import { assertEquals, assertThrows } from "@std/assert";
import { CmiRuntime } from "../src/cmi/runtime.ts";
import { CMI_ERRORS, CmiError } from "../src/cmi/errors.ts";

function makeRuntime(): CmiRuntime {
  const rt = new CmiRuntime();
  rt.initialize("learner-42", "Jane Doe");
  return rt;
}

Deno.test("initialize sets studentId and studentName", () => {
  const rt = makeRuntime();
  assertEquals(rt.getValue("cmi.core.student_id"), "learner-42");
  assertEquals(rt.getValue("cmi.core.student_name"), "Jane Doe");
});

Deno.test("getValue on uninitialized runtime throws NOT_INITIALIZED", () => {
  const rt = new CmiRuntime();
  const err = assertThrows(
    () => rt.getValue("cmi.core.student_id"),
    CmiError,
  );
  assertEquals(err.code, CMI_ERRORS.NOT_INITIALIZED);
});

Deno.test("double initialize throws ALREADY_INITIALIZED", () => {
  const rt = makeRuntime();
  const err = assertThrows(
    () => rt.initialize("x", "y"),
    CmiError,
  );
  assertEquals(err.code, CMI_ERRORS.ALREADY_INITIALIZED);
});

// ── lesson_status ──────────────────────────────────────

Deno.test("get/set lesson_status", () => {
  const rt = makeRuntime();
  assertEquals(rt.getValue("cmi.core.lesson_status"), "not attempted");
  rt.setValue("cmi.core.lesson_status", "incomplete");
  assertEquals(rt.getValue("cmi.core.lesson_status"), "incomplete");
  rt.setValue("cmi.core.lesson_status", "completed");
  assertEquals(rt.getValue("cmi.core.lesson_status"), "completed");
});

Deno.test("invalid lesson_status rejects with TYPE_MISMATCH", () => {
  const rt = makeRuntime();
  const err = assertThrows(
    () => rt.setValue("cmi.core.lesson_status", "banana"),
    CmiError,
  );
  assertEquals(err.code, CMI_ERRORS.TYPE_MISMATCH);
});

// ── lesson_location (bookmark) ─────────────────────────

Deno.test("get/set lesson_location (bookmark)", () => {
  const rt = makeRuntime();
  assertEquals(rt.getValue("cmi.core.lesson_location"), "");
  rt.setValue("cmi.core.lesson_location", "slide-7");
  assertEquals(rt.getValue("cmi.core.lesson_location"), "slide-7");
});

// ── score ──────────────────────────────────────────────

Deno.test("get/set score.raw/min/max", () => {
  const rt = makeRuntime();
  assertEquals(rt.getValue("cmi.core.score.raw"), "");

  rt.setValue("cmi.core.score.raw", "85");
  rt.setValue("cmi.core.score.min", "0");
  rt.setValue("cmi.core.score.max", "100");

  assertEquals(rt.getValue("cmi.core.score.raw"), "85");
  assertEquals(rt.getValue("cmi.core.score.min"), "0");
  assertEquals(rt.getValue("cmi.core.score.max"), "100");
});

Deno.test("score with non-numeric value throws TYPE_MISMATCH", () => {
  const rt = makeRuntime();
  const err = assertThrows(
    () => rt.setValue("cmi.core.score.raw", "abc"),
    CmiError,
  );
  assertEquals(err.code, CMI_ERRORS.TYPE_MISMATCH);
});

// ── suspend_data ───────────────────────────────────────

Deno.test("get/set suspend_data", () => {
  const rt = makeRuntime();
  assertEquals(rt.getValue("cmi.suspend_data"), "");

  const blob = JSON.stringify({ page: 3, answers: [1, 2] });
  rt.setValue("cmi.suspend_data", blob);
  assertEquals(rt.getValue("cmi.suspend_data"), blob);
});

// ── interactions ───────────────────────────────────────

Deno.test("interaction creation via indexed setValue", () => {
  const rt = makeRuntime();
  assertEquals(rt.getValue("cmi.interactions._count"), "0");

  rt.setValue("cmi.interactions.0.id", "q1");
  rt.setValue("cmi.interactions.0.type", "choice");
  rt.setValue("cmi.interactions.0.learner_response", "a");
  rt.setValue("cmi.interactions.0.result", "correct");
  rt.setValue("cmi.interactions.0.correct_responses.0.pattern", "a");

  assertEquals(rt.getValue("cmi.interactions._count"), "1");
  assertEquals(rt.getValue("cmi.interactions.0.id"), "q1");
  assertEquals(rt.getValue("cmi.interactions.0.type"), "choice");
  assertEquals(rt.getValue("cmi.interactions.0.learner_response"), "a");
  assertEquals(rt.getValue("cmi.interactions.0.result"), "correct");
  assertEquals(
    rt.getValue("cmi.interactions.0.correct_responses.0.pattern"),
    "a",
  );
});

Deno.test("interaction at index 2 auto-fills gaps", () => {
  const rt = makeRuntime();
  rt.setValue("cmi.interactions.2.id", "q3");
  assertEquals(rt.getValue("cmi.interactions._count"), "3");
  assertEquals(rt.getValue("cmi.interactions.0.id"), "");
  assertEquals(rt.getValue("cmi.interactions.2.id"), "q3");
});

// ── objectives ─────────────────────────────────────────

Deno.test("objective creation via indexed setValue", () => {
  const rt = makeRuntime();
  assertEquals(rt.getValue("cmi.objectives._count"), "0");

  rt.setValue("cmi.objectives.0.id", "obj-1");
  rt.setValue("cmi.objectives.0.status", "incomplete");
  rt.setValue("cmi.objectives.0.score.raw", "70");

  assertEquals(rt.getValue("cmi.objectives._count"), "1");
  assertEquals(rt.getValue("cmi.objectives.0.id"), "obj-1");
  assertEquals(rt.getValue("cmi.objectives.0.status"), "incomplete");
  assertEquals(rt.getValue("cmi.objectives.0.score.raw"), "70");
});

// ── commit ─────────────────────────────────────────────

Deno.test("commit triggers onCommit callback with state snapshot", () => {
  const rt = makeRuntime();
  let captured: unknown = null;
  rt.onCommit = (state) => {
    captured = state;
  };

  rt.setValue("cmi.core.lesson_status", "completed");
  rt.commit();

  assertEquals((captured as Record<string, unknown>).lessonStatus, "completed");
  assertEquals(rt.isDirty(), false);
});

Deno.test("commit clears dirty flag", () => {
  const rt = makeRuntime();
  rt.setValue("cmi.core.lesson_location", "p1");
  assertEquals(rt.isDirty(), true);
  rt.commit();
  assertEquals(rt.isDirty(), false);
});

// ── finish ─────────────────────────────────────────────

Deno.test("finish prevents further setValue", () => {
  const rt = makeRuntime();
  rt.finish();

  const err = assertThrows(
    () => rt.setValue("cmi.core.lesson_status", "completed"),
    CmiError,
  );
  assertEquals(err.code, CMI_ERRORS.TERMINATED);
});

Deno.test("finish calls commit", () => {
  const rt = makeRuntime();
  let committed = false;
  rt.onCommit = () => {
    committed = true;
  };
  rt.finish();
  assertEquals(committed, true);
});

// ── read-only guards ───────────────────────────────────

Deno.test("writing to student_id throws READ_ONLY", () => {
  const rt = makeRuntime();
  const err = assertThrows(
    () => rt.setValue("cmi.core.student_id", "hacker"),
    CmiError,
  );
  assertEquals(err.code, CMI_ERRORS.READ_ONLY);
});

// ── loadState ──────────────────────────────────────────

Deno.test("loadState restores persisted data", () => {
  const rt = makeRuntime();
  rt.loadState({
    lessonLocation: "slide-12",
    lessonStatus: "incomplete",
    scoreRaw: 55,
    suspendData: '{"x":1}',
  });

  assertEquals(rt.getValue("cmi.core.lesson_location"), "slide-12");
  assertEquals(rt.getValue("cmi.core.lesson_status"), "incomplete");
  assertEquals(rt.getValue("cmi.core.score.raw"), "55");
  assertEquals(rt.getValue("cmi.suspend_data"), '{"x":1}');
});
