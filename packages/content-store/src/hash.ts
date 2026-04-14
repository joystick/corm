import { Effect } from "effect";

export const sha256 = (data: Uint8Array): Effect.Effect<string> =>
  Effect.promise(async () => {
    const buf = data.buffer instanceof ArrayBuffer ? data.buffer : new Uint8Array(data).buffer;
    const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  });
