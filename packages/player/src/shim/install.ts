/**
 * Shim installer — attaches SCORM API objects to the window
 * so vendor-built SCOs can discover them via the standard
 * `window.API` / `window.API_1484_11` lookup chain.
 */

import type { CmiRuntime } from "../cmi/runtime.ts";
import { Scorm12API } from "./scorm12.ts";
import { Scorm2004API } from "./scorm2004.ts";

export interface ShimOptions {
  runtime: CmiRuntime;
  // deno-lint-ignore no-explicit-any
  window?: any;
  version?: "1.2" | "2004" | "both";
  studentId?: string;
  studentName?: string;
}

export interface InstalledShim {
  api12?: Scorm12API;
  api2004?: Scorm2004API;
  uninstall(): void;
}

export function installScormShim(options: ShimOptions): InstalledShim {
  const {
    runtime,
    window: win = globalThis,
    version = "both",
    studentId = "",
    studentName = "",
  } = options;

  let api12: Scorm12API | undefined;
  let api2004: Scorm2004API | undefined;

  if (version === "1.2" || version === "both") {
    api12 = new Scorm12API(runtime, studentId, studentName);
    win.API = api12;
  }

  if (version === "2004" || version === "both") {
    api2004 = new Scorm2004API(runtime, studentId, studentName);
    win.API_1484_11 = api2004;
  }

  return {
    api12,
    api2004,
    uninstall() {
      if (api12 && win.API === api12) {
        delete win.API;
      }
      if (api2004 && win.API_1484_11 === api2004) {
        delete win.API_1484_11;
      }
    },
  };
}
