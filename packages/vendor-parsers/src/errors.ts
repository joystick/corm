import { Data } from "effect";

export class VendorParseError extends Data.TaggedError("VendorParseError")<{
  message: string;
  vendor?: string;
}> {}
