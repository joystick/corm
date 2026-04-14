/**
 * Message chunking and reassembly for 128KB MQTT packet limits.
 *
 * Each chunk is serialized as:
 *   JSON header (first line) + "\n" + base64-encoded payload
 */

export const MAX_PACKET_SIZE = 131072; // 128KB
export const HEADER_SIZE = 64; // reserved for chunk header overhead
export const MAX_PAYLOAD_SIZE = MAX_PACKET_SIZE - HEADER_SIZE;

export interface ChunkHeader {
  messageId: string;
  chunkIndex: number;
  totalChunks: number;
  topic: string;
}

export interface Chunk {
  header: ChunkHeader;
  payload: Uint8Array;
}

/**
 * Split a message payload into chunks that each fit within the MQTT packet limit.
 * Small messages (< MAX_PAYLOAD_SIZE) produce a single chunk.
 */
export function chunkMessage(topic: string, payload: Uint8Array): Chunk[] {
  const messageId = crypto.randomUUID();
  const totalChunks = Math.max(1, Math.ceil(payload.length / MAX_PAYLOAD_SIZE));
  const chunks: Chunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * MAX_PAYLOAD_SIZE;
    const end = Math.min(start + MAX_PAYLOAD_SIZE, payload.length);
    chunks.push({
      header: {
        messageId,
        chunkIndex: i,
        totalChunks,
        topic,
      },
      payload: payload.slice(start, end),
    });
  }

  return chunks;
}

/** Serialize a chunk into a text-safe wire format for MQTT. */
export function serializeChunk(chunk: Chunk): Uint8Array {
  const headerJson = JSON.stringify(chunk.header);
  const payloadBase64 = encodeBase64(chunk.payload);
  const text = headerJson + "\n" + payloadBase64;
  return new TextEncoder().encode(text);
}

/** Deserialize a chunk from its wire format. */
export function deserializeChunk(data: Uint8Array): Chunk {
  const text = new TextDecoder().decode(data);
  const newlineIdx = text.indexOf("\n");
  if (newlineIdx === -1) {
    throw new Error("Invalid chunk format: no header/payload separator");
  }
  const header: ChunkHeader = JSON.parse(text.slice(0, newlineIdx));
  const payloadBase64 = text.slice(newlineIdx + 1);
  const payload = decodeBase64(payloadBase64);
  return { header, payload };
}

/**
 * Reassembles chunks into the original payload.
 * Handles out-of-order delivery.
 */
export class ChunkReassembler {
  private pending = new Map<
    string,
    { chunks: Map<number, Uint8Array>; totalChunks: number; createdAt: number }
  >();

  /**
   * Feed a chunk in. Returns the complete payload when all chunks
   * for a message have been received, or null if still waiting.
   */
  addChunk(chunk: Chunk): Uint8Array | null {
    const { messageId, chunkIndex, totalChunks } = chunk.header;

    if (!this.pending.has(messageId)) {
      this.pending.set(messageId, {
        chunks: new Map(),
        totalChunks,
        createdAt: Date.now(),
      });
    }

    const entry = this.pending.get(messageId)!;
    entry.chunks.set(chunkIndex, chunk.payload);

    if (entry.chunks.size === entry.totalChunks) {
      // All chunks received — reassemble in order
      const parts: Uint8Array[] = [];
      let totalLength = 0;
      for (let i = 0; i < entry.totalChunks; i++) {
        const part = entry.chunks.get(i)!;
        parts.push(part);
        totalLength += part.length;
      }

      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
      }

      this.pending.delete(messageId);
      return result;
    }

    return null;
  }

  /** Clean up stale incomplete messages older than maxAgeMs (default: 60s). */
  prune(maxAgeMs = 60_000): void {
    const now = Date.now();
    for (const [id, entry] of this.pending) {
      if (now - entry.createdAt > maxAgeMs) {
        this.pending.delete(id);
      }
    }
  }

  /** Number of incomplete messages being tracked. */
  get pendingCount(): number {
    return this.pending.size;
  }
}

// --- base64 helpers ---

function encodeBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

function decodeBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
