/**
 * SCORM 1.2 API shim.
 *
 * Exposes the eight LMS* methods that vendor-built SCOs
 * (Articulate Storyline, Rise, etc.) expect on `window.API`.
 * All methods return strings per the SCORM 1.2 specification.
 */

import { CmiError } from "../cmi/errors.ts";
import type { CmiRuntime } from "../cmi/runtime.ts";

const ERROR_STRINGS: Record<number, string> = {
  0: "No error",
  101: "General exception",
  201: "Invalid argument error",
  301: "Not initialized",
  401: "Not implemented error",
  403: "Element is read only",
  404: "Element is write only",
};

export class Scorm12API {
  private runtime: CmiRuntime;
  private lastError = 0;
  private studentId: string;
  private studentName: string;

  constructor(runtime: CmiRuntime, studentId = "", studentName = "") {
    this.runtime = runtime;
    this.studentId = studentId;
    this.studentName = studentName;
  }

  LMSInitialize(_param: string): string {
    try {
      this.runtime.initialize(this.studentId, this.studentName);
      this.lastError = 0;
      return "true";
    } catch {
      this.lastError = 101;
      return "false";
    }
  }

  LMSFinish(_param: string): string {
    try {
      this.runtime.finish();
      this.lastError = 0;
      return "true";
    } catch {
      this.lastError = 101;
      return "false";
    }
  }

  LMSGetValue(key: string): string {
    try {
      const value = this.runtime.getValue(key);
      this.lastError = 0;
      return value;
    } catch (e) {
      if (e instanceof CmiError) {
        this.lastError = e.code;
      } else {
        this.lastError = 101;
      }
      return "";
    }
  }

  LMSSetValue(key: string, value: string): string {
    try {
      this.runtime.setValue(key, value);
      this.lastError = 0;
      return "true";
    } catch (e) {
      if (e instanceof CmiError) {
        this.lastError = e.code;
      } else {
        this.lastError = 101;
      }
      return "false";
    }
  }

  LMSCommit(_param: string): string {
    try {
      this.runtime.commit();
      this.lastError = 0;
      return "true";
    } catch (e) {
      if (e instanceof CmiError) {
        this.lastError = e.code;
      } else {
        this.lastError = 101;
      }
      return "false";
    }
  }

  LMSGetLastError(): string {
    return String(this.lastError);
  }

  LMSGetErrorString(code: string): string {
    const n = Number(code);
    return ERROR_STRINGS[n] ?? "Unknown error";
  }

  LMSGetDiagnostic(code: string): string {
    const n = Number(code);
    return ERROR_STRINGS[n] ?? `Diagnostic for error ${code}`;
  }
}
