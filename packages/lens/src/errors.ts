/**
 * Lens error types using Effect TaggedError.
 */
import { Data } from "effect";

export class LensError extends Data.TaggedError("LensError")<{
  readonly message: string;
}> {}
