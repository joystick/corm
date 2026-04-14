/**
 * SCORM 2004 API shim.
 *
 * Exposes the eight RTE methods that vendor-built SCOs
 * expect on `window.API_1484_11`.
 * All methods return strings per the SCORM 2004 specification.
 */

import { CmiError } from "../cmi/errors.ts";
import type { CmiRuntime } from "../cmi/runtime.ts";

const ERROR_STRINGS: Record<number, string> = {
  0: "No error",
  101: "General exception",
  102: "General initialization failure",
  103: "Already initialized",
  104: "Content instance terminated",
  111: "General termination failure",
  112: "Termination before initialization",
  113: "Termination after termination",
  122: "Store data before initialization",
  123: "Store data after termination",
  132: "Retrieve data before initialization",
  133: "Retrieve data after termination",
  142: "Commit before initialization",
  143: "Commit after termination",
  201: "General argument error",
  301: "General get failure",
  351: "General set failure",
  391: "General commit failure",
  401: "Undefined data model element",
  402: "Unimplemented data model element",
  403: "Data model element value not initialized",
  404: "Data model element is read only",
  405: "Data model element is write only",
  406: "Data model element type mismatch",
  407: "Data model element value out of range",
  408: "Data model dependency not established",
};

/** Map CmiError codes to SCORM 2004-specific error codes based on state. */
function mapCmiError(code: number, context: "get" | "set" | "commit"): number {
  switch (code) {
    case 301: // NOT_INITIALIZED
      if (context === "get") return 132;
      if (context === "set") return 122;
      if (context === "commit") return 142;
      return 301;
    case 303: // TERMINATED
      if (context === "get") return 133;
      if (context === "set") return 123;
      if (context === "commit") return 143;
      return 303;
    default:
      return code;
  }
}

export class Scorm2004API {
  private runtime: CmiRuntime;
  private lastError = 0;
  private terminated = false;
  private studentId: string;
  private studentName: string;

  constructor(runtime: CmiRuntime, studentId = "", studentName = "") {
    this.runtime = runtime;
    this.studentId = studentId;
    this.studentName = studentName;
  }

  Initialize(_param: string): string {
    try {
      this.runtime.initialize(this.studentId, this.studentName);
      this.lastError = 0;
      this.terminated = false;
      return "true";
    } catch {
      this.lastError = 102;
      return "false";
    }
  }

  Terminate(_param: string): string {
    try {
      this.runtime.finish();
      this.lastError = 0;
      this.terminated = true;
      return "true";
    } catch {
      this.lastError = 111;
      return "false";
    }
  }

  GetValue(key: string): string {
    try {
      const value = this.runtime.getValue(key);
      this.lastError = 0;
      return value;
    } catch (e) {
      if (e instanceof CmiError) {
        this.lastError = mapCmiError(e.code, "get");
      } else {
        this.lastError = 101;
      }
      return "";
    }
  }

  SetValue(key: string, value: string): string {
    try {
      this.runtime.setValue(key, value);
      this.lastError = 0;
      return "true";
    } catch (e) {
      if (e instanceof CmiError) {
        this.lastError = mapCmiError(e.code, "set");
      } else {
        this.lastError = 101;
      }
      return "false";
    }
  }

  Commit(_param: string): string {
    try {
      this.runtime.commit();
      this.lastError = 0;
      return "true";
    } catch (e) {
      if (e instanceof CmiError) {
        this.lastError = mapCmiError(e.code, "commit");
      } else {
        this.lastError = 101;
      }
      return "false";
    }
  }

  GetLastError(): string {
    return String(this.lastError);
  }

  GetErrorString(code: string): string {
    const n = Number(code);
    return ERROR_STRINGS[n] ?? "Unknown error";
  }

  GetDiagnostic(code: string): string {
    const n = Number(code);
    return ERROR_STRINGS[n] ?? `Diagnostic for error ${code}`;
  }
}
