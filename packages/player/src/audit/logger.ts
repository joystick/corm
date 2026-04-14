/**
 * Audit logger — writes hash-chained interaction records to RxDB.
 *
 * Supports resume: on initialize() it loads existing interactions and
 * restores the chain head so new entries continue the sequence.
 */

import type { CormStore } from "../store/store.ts";
import { HashChain } from "./hash-chain.ts";

export interface AuditLoggerOptions {
  store: CormStore;
  attemptId: string;
}

export class AuditLogger {
  private chain: HashChain;
  private interactionIndex: number;
  private store: CormStore;
  private attemptId: string;

  constructor(options: AuditLoggerOptions) {
    this.store = options.store;
    this.attemptId = options.attemptId;
    this.chain = new HashChain();
    this.interactionIndex = 0;
  }

  /** Load existing chain from RxDB (for resume). */
  async initialize(): Promise<void> {
    const existing = await this.store.interactions
      .find({ selector: { attemptId: this.attemptId } })
      .exec();

    if (existing.length > 0) {
      const sorted = [...existing].sort((a, b) => a.index - b.index);
      const last = sorted[sorted.length - 1];
      if (last.hashChain) {
        this.chain = new HashChain(last.hashChain);
      }
      this.interactionIndex = sorted.length;
    }
  }

  /** Log an interaction (called after scoring). Returns the hash. */
  async logInteraction(data: {
    interactionId: string;
    type: string;
    learnerResponse: string;
    result: string;
    latency: string;
    description?: string;
    correctResponses?: string[];
    timestamp?: string;
  }): Promise<string> {
    const timestamp = data.timestamp ?? new Date().toISOString();

    const hash = await this.chain.append({
      interactionId: data.interactionId,
      type: data.type,
      learnerResponse: data.learnerResponse,
      result: data.result,
      timestamp,
    });

    const docId = `${this.attemptId}_${this.interactionIndex}`;

    await this.store.interactions.insert({
      id: docId,
      attemptId: this.attemptId,
      index: this.interactionIndex,
      interactionId: data.interactionId,
      type: data.type,
      timestamp,
      learnerResponse: data.learnerResponse,
      result: data.result,
      latency: data.latency,
      description: data.description ?? "",
      correctResponses: data.correctResponses
        ? JSON.stringify(data.correctResponses)
        : undefined,
      hashChain: hash,
    });

    this.interactionIndex++;
    return hash;
  }

  /** Verify the entire chain for this attempt. */
  async verify(): Promise<{ valid: boolean; brokenAt?: number }> {
    const docs = await this.store.interactions
      .find({ selector: { attemptId: this.attemptId } })
      .exec();

    const sorted = [...docs].sort((a, b) => a.index - b.index);

    const interactions = sorted.map((d) => ({
      interactionId: d.interactionId ?? "",
      type: d.type ?? "",
      learnerResponse: d.learnerResponse ?? "",
      result: d.result ?? "",
      timestamp: d.timestamp,
      hashChain: d.hashChain ?? "",
    }));

    return HashChain.verify(interactions);
  }
}
