/**
 * Assessment session — manages a quiz/test attempt, tracks responses,
 * scores interactions, and writes results to the CMI runtime.
 */

import type { CmiRuntime } from "../cmi/runtime.ts";
import { scoreInteraction } from "./scoring.ts";
import type {
  InteractionDefinition,
  InteractionResponse,
  InteractionResult,
} from "./types.ts";

interface TrackedResult {
  interaction: InteractionDefinition;
  result: InteractionResult | null;
}

export class AssessmentSession {
  private currentIndex = 0;
  private results: (InteractionResult | null)[];
  private startTime: number;

  constructor(
    private interactions: InteractionDefinition[],
    private runtime: CmiRuntime,
    private masteryScore = 0.8,
  ) {
    this.results = new Array(interactions.length).fill(null);
    this.startTime = Date.now();
  }

  /** Current interaction index. */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /** Get the current interaction definition, or null if past the end. */
  getCurrentInteraction(): InteractionDefinition | null {
    return this.interactions[this.currentIndex] ?? null;
  }

  /** Submit a response for the current interaction. */
  submitResponse(learnerResponse: string): InteractionResult {
    const definition = this.interactions[this.currentIndex];
    if (!definition) {
      throw new Error(
        `No interaction at index ${this.currentIndex}`,
      );
    }

    const now = new Date();
    const elapsed = Date.now() - this.startTime;
    const latency = formatDuration(elapsed);

    const response: InteractionResponse = {
      interactionId: definition.id,
      learnerResponse,
      timestamp: now.toISOString(),
      latency,
    };

    const result = scoreInteraction(definition, response);
    this.results[this.currentIndex] = result;

    // Write to CMI runtime
    const idx = this.currentIndex;
    this.runtime.setValue(`cmi.interactions.${idx}.id`, definition.id);
    this.runtime.setValue(`cmi.interactions.${idx}.type`, definition.type);
    this.runtime.setValue(
      `cmi.interactions.${idx}.learner_response`,
      learnerResponse,
    );
    this.runtime.setValue(
      `cmi.interactions.${idx}.result`,
      result.result,
    );
    this.runtime.setValue(
      `cmi.interactions.${idx}.latency`,
      latency,
    );
    this.runtime.setValue(
      `cmi.interactions.${idx}.timestamp`,
      now.toISOString(),
    );

    // Write correct response patterns
    for (let i = 0; i < definition.correctResponses.length; i++) {
      this.runtime.setValue(
        `cmi.interactions.${idx}.correct_responses.${i}.pattern`,
        definition.correctResponses[i],
      );
    }

    // Reset start time for next interaction's latency
    this.startTime = Date.now();

    // If all interactions answered, finalize
    if (this.isComplete()) {
      this.finalize();
    }

    return result;
  }

  /** Move to the next interaction. Returns false if already at end. */
  next(): boolean {
    if (this.currentIndex < this.interactions.length - 1) {
      this.currentIndex++;
      this.startTime = Date.now();
      return true;
    }
    return false;
  }

  /** Move to the previous interaction. Returns false if at start. */
  previous(): boolean {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.startTime = Date.now();
      return true;
    }
    return false;
  }

  /** Calculate overall score. */
  getScore(): { raw: number; min: number; max: number } {
    let raw = 0;
    let max = 0;
    for (let i = 0; i < this.interactions.length; i++) {
      const weighting = this.interactions[i].weighting ?? 1;
      max += weighting;
      const result = this.results[i];
      if (result) {
        raw += result.score;
      }
    }
    return { raw, min: 0, max };
  }

  /** Whether all interactions have been answered. */
  isComplete(): boolean {
    return this.results.every((r) => r !== null);
  }

  /** Get all results paired with their interaction definitions. */
  getResults(): TrackedResult[] {
    return this.interactions.map((interaction, i) => ({
      interaction,
      result: this.results[i],
    }));
  }

  // ── Private ────────────────────────────────────────────

  private finalize(): void {
    const { raw, min, max } = this.getScore();

    this.runtime.setValue("cmi.core.score.raw", String(raw));
    this.runtime.setValue("cmi.core.score.min", String(min));
    this.runtime.setValue("cmi.core.score.max", String(max));

    const ratio = max > 0 ? raw / max : 0;
    const status = ratio >= this.masteryScore ? "passed" : "failed";
    this.runtime.setValue("cmi.core.lesson_status", status);
  }
}

/** Format milliseconds as ISO 8601 duration (PTnS). */
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `PT${seconds}S`;
}
