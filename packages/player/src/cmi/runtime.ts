/**
 * CMI Runtime — the SCORM state machine.
 *
 * Maps dot-notation CMI keys to the CmiData model,
 * validates writes, and triggers persistence callbacks.
 */

import { CMI_ERRORS, CmiError } from "./errors.ts";
import {
  type CmiData,
  type CmiInteraction,
  type CmiObjective,
  createDefaultCmiData,
  type ExitValue,
  type LessonStatus,
  VALID_EXIT_VALUES,
  VALID_LESSON_STATUSES,
} from "./state.ts";

export class CmiRuntime {
  private state: CmiData;
  private dirty = false;
  private initialized = false;
  private finished = false;

  onCommit?: (state: CmiData) => void | Promise<void>;

  constructor() {
    this.state = createDefaultCmiData();
  }

  /** Boot the runtime for a learner session. */
  initialize(studentId: string, studentName: string): void {
    if (this.initialized) {
      throw new CmiError(
        CMI_ERRORS.ALREADY_INITIALIZED,
        "Runtime already initialized",
      );
    }
    this.state.studentId = studentId;
    this.state.studentName = studentName;
    this.initialized = true;
    this.finished = false;
  }

  /** Read a CMI value by dot-notation key. */
  getValue(key: string): string {
    this.assertInitialized();

    // Collection counts
    if (key === "cmi.interactions._count") {
      return String(this.state.interactions.length);
    }
    if (key === "cmi.objectives._count") {
      return String(this.state.objectives.length);
    }

    // Indexed interaction fields
    const interactionMatch = key.match(
      /^cmi\.interactions\.(\d+)\.(.+)$/,
    );
    if (interactionMatch) {
      const idx = Number(interactionMatch[1]);
      const field = interactionMatch[2];
      const interaction = this.state.interactions[idx];
      if (!interaction) {
        throw new CmiError(
          CMI_ERRORS.DATA_MODEL_NOT_INITIALIZED,
          `No interaction at index ${idx}`,
        );
      }
      return this.getInteractionField(interaction, field);
    }

    // Indexed objective fields
    const objectiveMatch = key.match(
      /^cmi\.objectives\.(\d+)\.(.+)$/,
    );
    if (objectiveMatch) {
      const idx = Number(objectiveMatch[1]);
      const field = objectiveMatch[2];
      const objective = this.state.objectives[idx];
      if (!objective) {
        throw new CmiError(
          CMI_ERRORS.DATA_MODEL_NOT_INITIALIZED,
          `No objective at index ${idx}`,
        );
      }
      return this.getObjectiveField(objective, field);
    }

    // Scalar fields
    return this.getScalarField(key);
  }

  /** Write a CMI value by dot-notation key. */
  setValue(key: string, value: string): void {
    this.assertInitialized();
    this.assertNotFinished();

    // Read-only fields
    if (
      key === "cmi.core.student_id" ||
      key === "cmi.core.student_name" ||
      key === "cmi.interactions._count" ||
      key === "cmi.objectives._count"
    ) {
      throw new CmiError(CMI_ERRORS.READ_ONLY, `${key} is read-only`);
    }

    // Indexed interaction fields
    const interactionMatch = key.match(
      /^cmi\.interactions\.(\d+)\.(.+)$/,
    );
    if (interactionMatch) {
      const idx = Number(interactionMatch[1]);
      const field = interactionMatch[2];
      this.ensureInteraction(idx);
      this.setInteractionField(idx, field, value);
      this.dirty = true;
      return;
    }

    // Indexed objective fields
    const objectiveMatch = key.match(
      /^cmi\.objectives\.(\d+)\.(.+)$/,
    );
    if (objectiveMatch) {
      const idx = Number(objectiveMatch[1]);
      const field = objectiveMatch[2];
      this.ensureObjective(idx);
      this.setObjectiveField(idx, field, value);
      this.dirty = true;
      return;
    }

    // Scalar fields
    this.setScalarField(key, value);
    this.dirty = true;
  }

  /** Persist current state via onCommit callback. */
  commit(): void {
    this.assertInitialized();
    if (this.onCommit) {
      this.onCommit(this.getState());
    }
    this.dirty = false;
  }

  /** Finalize session — commits and locks further writes. */
  finish(): void {
    this.assertInitialized();
    this.commit();
    this.finished = true;
  }

  /** Return a deep copy of current state. */
  getState(): CmiData {
    return structuredClone(this.state);
  }

  /** Restore state from persistence. */
  loadState(data: Partial<CmiData>): void {
    Object.assign(this.state, structuredClone(data));
  }

  /** Whether uncommitted changes exist. */
  isDirty(): boolean {
    return this.dirty;
  }

  // ── Private helpers ──────────────────────────────────

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new CmiError(
        CMI_ERRORS.NOT_INITIALIZED,
        "Runtime not initialized",
      );
    }
  }

  private assertNotFinished(): void {
    if (this.finished) {
      throw new CmiError(
        CMI_ERRORS.TERMINATED,
        "Runtime already terminated",
      );
    }
  }

  private getScalarField(key: string): string {
    switch (key) {
      case "cmi.core.student_id":
        return this.state.studentId;
      case "cmi.core.student_name":
        return this.state.studentName;
      case "cmi.core.lesson_location":
        return this.state.lessonLocation;
      case "cmi.core.lesson_status":
        return this.state.lessonStatus;
      case "cmi.core.exit":
        return this.state.exit;
      case "cmi.core.score.raw":
        return this.state.scoreRaw !== null ? String(this.state.scoreRaw) : "";
      case "cmi.core.score.min":
        return this.state.scoreMin !== null ? String(this.state.scoreMin) : "";
      case "cmi.core.score.max":
        return this.state.scoreMax !== null ? String(this.state.scoreMax) : "";
      case "cmi.core.session_time":
        return this.state.sessionTime;
      case "cmi.core.total_time":
        return this.state.totalTime;
      case "cmi.suspend_data":
        return this.state.suspendData;
      default:
        throw new CmiError(
          CMI_ERRORS.DATA_MODEL_NOT_INITIALIZED,
          `Unknown CMI key: ${key}`,
        );
    }
  }

  private setScalarField(key: string, value: string): void {
    switch (key) {
      case "cmi.core.lesson_location":
        this.state.lessonLocation = value;
        break;
      case "cmi.core.lesson_status":
        if (
          !VALID_LESSON_STATUSES.includes(value as LessonStatus)
        ) {
          throw new CmiError(
            CMI_ERRORS.TYPE_MISMATCH,
            `Invalid lesson_status: "${value}"`,
          );
        }
        this.state.lessonStatus = value as LessonStatus;
        break;
      case "cmi.core.exit":
        if (!VALID_EXIT_VALUES.includes(value as ExitValue)) {
          throw new CmiError(
            CMI_ERRORS.TYPE_MISMATCH,
            `Invalid exit value: "${value}"`,
          );
        }
        this.state.exit = value as ExitValue;
        break;
      case "cmi.core.score.raw":
        this.state.scoreRaw = this.parseNumber(value);
        break;
      case "cmi.core.score.min":
        this.state.scoreMin = this.parseNumber(value);
        break;
      case "cmi.core.score.max":
        this.state.scoreMax = this.parseNumber(value);
        break;
      case "cmi.core.session_time":
        this.state.sessionTime = value;
        break;
      case "cmi.core.total_time":
        this.state.totalTime = value;
        break;
      case "cmi.suspend_data":
        this.state.suspendData = value;
        break;
      default:
        throw new CmiError(
          CMI_ERRORS.DATA_MODEL_NOT_INITIALIZED,
          `Unknown or read-only CMI key: ${key}`,
        );
    }
  }

  private parseNumber(value: string): number | null {
    if (value === "") return null;
    const n = Number(value);
    if (Number.isNaN(n)) {
      throw new CmiError(
        CMI_ERRORS.TYPE_MISMATCH,
        `Expected number, got "${value}"`,
      );
    }
    return n;
  }

  private ensureInteraction(idx: number): void {
    while (this.state.interactions.length <= idx) {
      this.state.interactions.push(createEmptyInteraction());
    }
  }

  private ensureObjective(idx: number): void {
    while (this.state.objectives.length <= idx) {
      this.state.objectives.push(createEmptyObjective());
    }
  }

  private getInteractionField(
    interaction: CmiInteraction,
    field: string,
  ): string {
    switch (field) {
      case "id":
        return interaction.id;
      case "type":
        return interaction.type;
      case "timestamp":
        return interaction.timestamp;
      case "learner_response":
        return interaction.learnerResponse;
      case "result":
        return interaction.result;
      case "latency":
        return interaction.latency;
      case "description":
        return interaction.description;
      case "correct_responses._count":
        return String(interaction.correctResponses.length);
      default: {
        const crMatch = field.match(/^correct_responses\.(\d+)\.pattern$/);
        if (crMatch) {
          const crIdx = Number(crMatch[1]);
          return interaction.correctResponses[crIdx] ?? "";
        }
        throw new CmiError(
          CMI_ERRORS.DATA_MODEL_NOT_INITIALIZED,
          `Unknown interaction field: ${field}`,
        );
      }
    }
  }

  private setInteractionField(
    idx: number,
    field: string,
    value: string,
  ): void {
    const interaction = this.state.interactions[idx];
    switch (field) {
      case "id":
        interaction.id = value;
        break;
      case "type":
        interaction.type = value;
        break;
      case "timestamp":
        interaction.timestamp = value;
        break;
      case "learner_response":
        interaction.learnerResponse = value;
        break;
      case "result":
        interaction.result = value;
        break;
      case "latency":
        interaction.latency = value;
        break;
      case "description":
        interaction.description = value;
        break;
      default: {
        const crMatch = field.match(/^correct_responses\.(\d+)\.pattern$/);
        if (crMatch) {
          const crIdx = Number(crMatch[1]);
          while (interaction.correctResponses.length <= crIdx) {
            interaction.correctResponses.push("");
          }
          interaction.correctResponses[crIdx] = value;
          break;
        }
        throw new CmiError(
          CMI_ERRORS.DATA_MODEL_NOT_INITIALIZED,
          `Unknown interaction field: ${field}`,
        );
      }
    }
  }

  private getObjectiveField(objective: CmiObjective, field: string): string {
    switch (field) {
      case "id":
        return objective.id;
      case "status":
        return objective.status;
      case "score.raw":
        return objective.scoreRaw !== null ? String(objective.scoreRaw) : "";
      case "score.min":
        return objective.scoreMin !== null ? String(objective.scoreMin) : "";
      case "score.max":
        return objective.scoreMax !== null ? String(objective.scoreMax) : "";
      default:
        throw new CmiError(
          CMI_ERRORS.DATA_MODEL_NOT_INITIALIZED,
          `Unknown objective field: ${field}`,
        );
    }
  }

  private setObjectiveField(
    idx: number,
    field: string,
    value: string,
  ): void {
    const objective = this.state.objectives[idx];
    switch (field) {
      case "id":
        objective.id = value;
        break;
      case "status":
        objective.status = value;
        break;
      case "score.raw":
        objective.scoreRaw = this.parseNumber(value);
        break;
      case "score.min":
        objective.scoreMin = this.parseNumber(value);
        break;
      case "score.max":
        objective.scoreMax = this.parseNumber(value);
        break;
      default:
        throw new CmiError(
          CMI_ERRORS.DATA_MODEL_NOT_INITIALIZED,
          `Unknown objective field: ${field}`,
        );
    }
  }
}

function createEmptyInteraction(): CmiInteraction {
  return {
    id: "",
    type: "",
    timestamp: "",
    learnerResponse: "",
    result: "",
    latency: "",
    description: "",
    correctResponses: [],
  };
}

function createEmptyObjective(): CmiObjective {
  return {
    id: "",
    status: "",
    scoreRaw: null,
    scoreMin: null,
    scoreMax: null,
  };
}
