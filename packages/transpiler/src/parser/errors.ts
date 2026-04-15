import { Data } from "effect";

export class ScormParseError extends Data.TaggedError("ScormParseError")<{
  message: string;
  path?: string;
}> {}

export class ScormManifestNotFound extends Data.TaggedError(
  "ScormManifestNotFound",
)<{
  message: string;
}> {}

export class ScormVersionUnsupported extends Data.TaggedError(
  "ScormVersionUnsupported",
)<{
  version: string;
  message: string;
}> {}
