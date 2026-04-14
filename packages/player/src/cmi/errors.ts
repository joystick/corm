/**
 * SCORM CMI error codes and error class.
 */

export const CMI_ERRORS = {
  NO_ERROR: 0,
  GENERAL_EXCEPTION: 101,
  NOT_INITIALIZED: 301,
  ALREADY_INITIALIZED: 302,
  TERMINATED: 303,
  DATA_MODEL_NOT_INITIALIZED: 401,
  READ_ONLY: 403,
  WRITE_ONLY: 404,
  TYPE_MISMATCH: 405,
} as const;

export type CmiErrorCode = (typeof CMI_ERRORS)[keyof typeof CMI_ERRORS];

export class CmiError extends Error {
  readonly code: CmiErrorCode;

  constructor(code: CmiErrorCode, message?: string) {
    super(message ?? `CMI Error ${code}`);
    this.name = "CmiError";
    this.code = code;
  }
}
