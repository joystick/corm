/**
 * Proctoring tiers for STCW assessment integrity.
 *
 * "none"  — no proctoring, no acknowledgment
 * "honor" — learner acknowledges honesty pledge, per-question timing
 */

export type ProctoringTier = "none" | "honor";

export interface ProctoringConfig {
  tier: ProctoringTier;
  requireAcknowledgment: boolean;
  trackTimePerQuestion: boolean;
}

export function getProctoringConfig(tier: ProctoringTier): ProctoringConfig {
  switch (tier) {
    case "honor":
      return {
        tier: "honor",
        requireAcknowledgment: true,
        trackTimePerQuestion: true,
      };
    case "none":
    default:
      return {
        tier: "none",
        requireAcknowledgment: false,
        trackTimePerQuestion: false,
      };
  }
}

export interface QuestionTiming {
  interactionId: string;
  startedAt: string;
  submittedAt: string;
  durationMs: number;
}

export class ProctoringMonitor {
  private config: ProctoringConfig;
  private acknowledged: boolean;
  private timings: QuestionTiming[];
  private currentQuestionStart: number | null;
  private currentInteractionId: string | null;

  constructor(tier: ProctoringTier) {
    this.config = getProctoringConfig(tier);
    this.acknowledged = false;
    this.timings = [];
    this.currentQuestionStart = null;
    this.currentInteractionId = null;
  }

  /** Check if acknowledgment is needed and not yet given. */
  needsAcknowledgment(): boolean {
    return this.config.requireAcknowledgment && !this.acknowledged;
  }

  /** Record acknowledgment. */
  acknowledge(): void {
    this.acknowledged = true;
  }

  /** Start timing a question. */
  startQuestion(interactionId: string): void {
    this.currentInteractionId = interactionId;
    this.currentQuestionStart = Date.now();
  }

  /** Stop timing (called on submit). */
  stopQuestion(): QuestionTiming | null {
    if (
      this.currentQuestionStart === null ||
      this.currentInteractionId === null
    ) {
      return null;
    }

    const now = Date.now();
    const timing: QuestionTiming = {
      interactionId: this.currentInteractionId,
      startedAt: new Date(this.currentQuestionStart).toISOString(),
      submittedAt: new Date(now).toISOString(),
      durationMs: now - this.currentQuestionStart,
    };

    this.timings.push(timing);
    this.currentQuestionStart = null;
    this.currentInteractionId = null;
    return timing;
  }

  /** Get all timings. */
  getTimings(): QuestionTiming[] {
    return [...this.timings];
  }

  /** Get total assessment duration. */
  getTotalDuration(): number {
    return this.timings.reduce((sum, t) => sum + t.durationMs, 0);
  }
}
