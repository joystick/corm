/**
 * Hash-chained audit trail for STCW-compliant interaction logging.
 *
 * Each interaction is linked to its predecessor via SHA-256, forming
 * a tamper-evident chain. Breaking any link invalidates the entire
 * sequence.
 */

const GENESIS_HASH = "0".repeat(64);

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return hex.join("");
}

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(buf);
}

export interface HashableInteraction {
  interactionId: string;
  type: string;
  learnerResponse: string;
  result: string;
  timestamp: string;
}

export class HashChain {
  private previousHash: string;

  constructor(initialHash?: string) {
    this.previousHash = initialHash ?? GENESIS_HASH;
  }

  /** Compute hash for an interaction and advance the chain. */
  async append(data: HashableInteraction): Promise<string> {
    const payload = [
      this.previousHash,
      data.interactionId,
      data.type,
      data.learnerResponse,
      data.result,
      data.timestamp,
    ].join("|");

    const hash = await sha256(payload);
    this.previousHash = hash;
    return hash;
  }

  /** Get current chain head. */
  getHead(): string {
    return this.previousHash;
  }

  /** Verify a chain of interactions. */
  static async verify(
    interactions: Array<HashableInteraction & { hashChain: string }>,
  ): Promise<{ valid: boolean; brokenAt?: number }> {
    let previousHash = GENESIS_HASH;

    for (let i = 0; i < interactions.length; i++) {
      const ix = interactions[i];
      const payload = [
        previousHash,
        ix.interactionId,
        ix.type,
        ix.learnerResponse,
        ix.result,
        ix.timestamp,
      ].join("|");

      const expected = await sha256(payload);
      if (expected !== ix.hashChain) {
        return { valid: false, brokenAt: i };
      }
      previousHash = expected;
    }

    return { valid: true };
  }
}
