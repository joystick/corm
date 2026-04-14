import { assertEquals } from "@std/assert";
import { CmiRuntime } from "../src/cmi/runtime.ts";
import { Scorm12API } from "../src/shim/scorm12.ts";
import { Scorm2004API } from "../src/shim/scorm2004.ts";
import { installScormShim } from "../src/shim/install.ts";

// ── SCORM 1.2 ──────────────────────────────────────────

Deno.test("SCORM 1.2: LMSInitialize returns 'true'", () => {
  const api = new Scorm12API(new CmiRuntime(), "stu-1", "Jane Doe");
  assertEquals(api.LMSInitialize(""), "true");
});

Deno.test("SCORM 1.2: LMSGetValue returns student_id after init", () => {
  const api = new Scorm12API(new CmiRuntime(), "stu-1", "Jane Doe");
  api.LMSInitialize("");
  assertEquals(api.LMSGetValue("cmi.core.student_id"), "stu-1");
});

Deno.test("SCORM 1.2: LMSSetValue sets lesson_status", () => {
  const api = new Scorm12API(new CmiRuntime(), "stu-1", "Jane Doe");
  api.LMSInitialize("");
  assertEquals(api.LMSSetValue("cmi.core.lesson_status", "completed"), "true");
  assertEquals(api.LMSGetValue("cmi.core.lesson_status"), "completed");
});

Deno.test("SCORM 1.2: LMSCommit triggers runtime commit", () => {
  let committed = false;
  const rt = new CmiRuntime();
  rt.onCommit = () => {
    committed = true;
  };
  const api = new Scorm12API(rt, "stu-1", "Jane Doe");
  api.LMSInitialize("");
  api.LMSSetValue("cmi.core.lesson_status", "completed");
  assertEquals(api.LMSCommit(""), "true");
  assertEquals(committed, true);
});

Deno.test("SCORM 1.2: LMSFinish terminates session", () => {
  const api = new Scorm12API(new CmiRuntime(), "stu-1", "Jane Doe");
  api.LMSInitialize("");
  assertEquals(api.LMSFinish(""), "true");
});

Deno.test("SCORM 1.2: LMSGetValue before init returns '' and sets error 301", () => {
  const api = new Scorm12API(new CmiRuntime(), "stu-1", "Jane Doe");
  assertEquals(api.LMSGetValue("cmi.core.student_id"), "");
  assertEquals(api.LMSGetLastError(), "301");
});

Deno.test("SCORM 1.2: LMSSetValue after finish returns 'false' and sets error", () => {
  const api = new Scorm12API(new CmiRuntime(), "stu-1", "Jane Doe");
  api.LMSInitialize("");
  api.LMSFinish("");
  assertEquals(
    api.LMSSetValue("cmi.core.lesson_status", "completed"),
    "false",
  );
  // Error 303 (TERMINATED) from the runtime
  assertEquals(api.LMSGetLastError(), "303");
});

Deno.test("SCORM 1.2: LMSGetLastError returns '0' after successful call", () => {
  const api = new Scorm12API(new CmiRuntime(), "stu-1", "Jane Doe");
  api.LMSInitialize("");
  api.LMSGetValue("cmi.core.student_id");
  assertEquals(api.LMSGetLastError(), "0");
});

Deno.test("SCORM 1.2: LMSGetErrorString returns human-readable message", () => {
  const api = new Scorm12API(new CmiRuntime());
  assertEquals(api.LMSGetErrorString("0"), "No error");
  assertEquals(api.LMSGetErrorString("301"), "Not initialized");
  assertEquals(api.LMSGetErrorString("403"), "Element is read only");
});

// ── SCORM 2004 ─────────────────────────────────────────

Deno.test("SCORM 2004: Initialize returns 'true'", () => {
  const api = new Scorm2004API(new CmiRuntime(), "stu-1", "Jane Doe");
  assertEquals(api.Initialize(""), "true");
});

Deno.test("SCORM 2004: GetValue returns student_id", () => {
  const api = new Scorm2004API(new CmiRuntime(), "stu-1", "Jane Doe");
  api.Initialize("");
  assertEquals(api.GetValue("cmi.core.student_id"), "stu-1");
});

Deno.test("SCORM 2004: SetValue sets lesson_location", () => {
  const api = new Scorm2004API(new CmiRuntime(), "stu-1", "Jane Doe");
  api.Initialize("");
  assertEquals(api.SetValue("cmi.core.lesson_location", "page-5"), "true");
  assertEquals(api.GetValue("cmi.core.lesson_location"), "page-5");
});

Deno.test("SCORM 2004: Commit works", () => {
  let committed = false;
  const rt = new CmiRuntime();
  rt.onCommit = () => {
    committed = true;
  };
  const api = new Scorm2004API(rt, "stu-1", "Jane Doe");
  api.Initialize("");
  assertEquals(api.Commit(""), "true");
  assertEquals(committed, true);
});

Deno.test("SCORM 2004: Terminate finalizes", () => {
  const api = new Scorm2004API(new CmiRuntime(), "stu-1", "Jane Doe");
  api.Initialize("");
  assertEquals(api.Terminate(""), "true");
});

Deno.test("SCORM 2004: GetValue before init sets error 132", () => {
  const api = new Scorm2004API(new CmiRuntime(), "stu-1", "Jane Doe");
  assertEquals(api.GetValue("cmi.core.student_id"), "");
  assertEquals(api.GetLastError(), "132");
});

Deno.test("SCORM 2004: SetValue after terminate sets error 123", () => {
  const api = new Scorm2004API(new CmiRuntime(), "stu-1", "Jane Doe");
  api.Initialize("");
  api.Terminate("");
  assertEquals(api.SetValue("cmi.core.lesson_status", "completed"), "false");
  assertEquals(api.GetLastError(), "123");
});

Deno.test("SCORM 2004: GetLastError and GetErrorString work", () => {
  const api = new Scorm2004API(new CmiRuntime());
  assertEquals(api.GetLastError(), "0");
  assertEquals(api.GetErrorString("0"), "No error");
  assertEquals(
    api.GetErrorString("132"),
    "Retrieve data before initialization",
  );
  assertEquals(api.GetErrorString("123"), "Store data after termination");
});

// ── Install ────────────────────────────────────────────

Deno.test("installScormShim sets window.API and window.API_1484_11", () => {
  // deno-lint-ignore no-explicit-any
  const fakeWindow: any = {};
  const rt = new CmiRuntime();
  const shim = installScormShim({
    runtime: rt,
    window: fakeWindow,
    studentId: "stu-1",
    studentName: "Jane Doe",
  });
  assertEquals(fakeWindow.API instanceof Scorm12API, true);
  assertEquals(fakeWindow.API_1484_11 instanceof Scorm2004API, true);
  assertEquals(shim.api12 instanceof Scorm12API, true);
  assertEquals(shim.api2004 instanceof Scorm2004API, true);
});

Deno.test("uninstall removes APIs from window", () => {
  // deno-lint-ignore no-explicit-any
  const fakeWindow: any = {};
  const rt = new CmiRuntime();
  const shim = installScormShim({
    runtime: rt,
    window: fakeWindow,
    studentId: "stu-1",
    studentName: "Jane Doe",
  });
  shim.uninstall();
  assertEquals(fakeWindow.API, undefined);
  assertEquals(fakeWindow.API_1484_11, undefined);
});
