/**
 * Content delta sync client.
 * Compares local vs remote content manifests and produces a diff
 * of files that need to be added, updated, or deleted.
 */

export interface ContentManifestFile {
  path: string;
  checksum: string;
  size: number;
}

export interface ContentManifest {
  courseId: string;
  version: string;
  files: ContentManifestFile[];
}

export interface ContentDiffEntry {
  path: string;
  action: "add" | "update" | "delete";
  checksum: string;
}

export interface ContentSyncOptions {
  courseId: string;
}

export class ContentSyncClient {
  private localManifest: ContentManifest | null = null;
  readonly courseId: string;

  constructor(options: ContentSyncOptions) {
    this.courseId = options.courseId;
  }

  /**
   * Compare local vs remote manifest, return files that need updating.
   */
  diff(remote: ContentManifest): ContentDiffEntry[] {
    const results: ContentDiffEntry[] = [];
    const localFiles = new Map<string, string>();

    if (this.localManifest) {
      for (const f of this.localManifest.files) {
        localFiles.set(f.path, f.checksum);
      }
    }

    const remoteFiles = new Map<string, string>();
    for (const f of remote.files) {
      remoteFiles.set(f.path, f.checksum);
    }

    // Files in remote but not local -> add
    // Files in both but different checksum -> update
    for (const [path, checksum] of remoteFiles) {
      const localChecksum = localFiles.get(path);
      if (localChecksum === undefined) {
        results.push({ path, action: "add", checksum });
      } else if (localChecksum !== checksum) {
        results.push({ path, action: "update", checksum });
      }
    }

    // Files in local but not remote -> delete
    for (const [path] of localFiles) {
      if (!remoteFiles.has(path)) {
        const checksum = localFiles.get(path)!;
        results.push({ path, action: "delete", checksum });
      }
    }

    return results;
  }

  /** Set the local manifest (loaded from storage). */
  setLocalManifest(manifest: ContentManifest): void {
    this.localManifest = manifest;
  }

  /** Get the current local manifest. */
  getLocalManifest(): ContentManifest | null {
    return this.localManifest;
  }
}
