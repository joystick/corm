import { Effect } from "effect";
import type { Checksums } from "@corm/schema";
import { sha256 } from "./hash.ts";

export type { Checksums };

export interface ChecksumDiff {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
}

export const computeChecksums = (
  files: Map<string, Uint8Array>,
  version: string,
  previousVersion?: string,
): Effect.Effect<Checksums> =>
  Effect.gen(function* () {
    const fileEntries: Record<string, string> = {};
    for (const [path, data] of files) {
      fileEntries[path] = yield* sha256(data);
    }
    return {
      version,
      ...(previousVersion !== undefined ? { previousVersion } : {}),
      files: fileEntries,
    };
  });

export const diffChecksums = (old_: Checksums, new_: Checksums): ChecksumDiff => {
  const oldFiles = old_.files;
  const newFiles = new_.files;

  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  for (const [path, hash] of Object.entries(newFiles)) {
    if (!(path in oldFiles)) {
      added.push(path);
    } else if (oldFiles[path] !== hash) {
      changed.push(path);
    } else {
      unchanged.push(path);
    }
  }

  for (const path of Object.keys(oldFiles)) {
    if (!(path in newFiles)) {
      removed.push(path);
    }
  }

  return { added, changed, removed, unchanged };
};
