/**
 * Bridge — wires CmiRuntime to RxDB persistence with resume capability.
 *
 * On initialize(), it creates/finds an enrollment, creates an attempt,
 * optionally resumes from a suspended previous attempt, and wires
 * runtime.onCommit to persist CMI state to RxDB.
 */

import type { CmiData } from "./cmi/state.ts";
import type { CmiRuntime } from "./cmi/runtime.ts";
import type { CormStore } from "./store/store.ts";

export interface BridgeOptions {
  store: CormStore;
  runtime: CmiRuntime;
  learnerId: string;
  courseId: string;
}

export interface Bridge {
  /** Create/find enrollment, create attempt, load suspended CMI state, wire onCommit. */
  initialize(): Promise<void>;
  /** Final commit and cleanup. */
  dispose(): Promise<void>;
  /** The enrollment ID created during initialize. */
  enrollmentId: string;
  /** The attempt ID created during initialize. */
  attemptId: string;
  /** The attempt number created during initialize. */
  attemptNumber: number;
}

export async function createBridge(options: BridgeOptions): Promise<Bridge> {
  const { store, runtime, learnerId, courseId } = options;

  let enrollmentId = "";
  let attemptId = "";
  let attemptNumber = 0;
  let disposed = false;

  async function initialize(): Promise<void> {
    // 1. Find or create enrollment
    enrollmentId = `${learnerId}_${courseId}`;
    const existingEnrollment = await store.enrollments
      .findOne(enrollmentId)
      .exec();

    if (!existingEnrollment) {
      await store.enrollments.insert({
        id: enrollmentId,
        learnerId,
        courseId,
        status: "enrolled",
        enrolledAt: new Date().toISOString(),
      });
    }

    // 2. Determine attempt number
    const existingAttempts = await store.attempts
      .find({ selector: { enrollmentId } })
      .exec();
    attemptNumber = existingAttempts.length + 1;

    // 3. Create new attempt
    attemptId = `${enrollmentId}_${attemptNumber}`;
    await store.attempts.insert({
      id: attemptId,
      enrollmentId,
      attemptNumber,
      startedAt: new Date().toISOString(),
      status: "incomplete",
    });

    // 4. Check for suspended previous attempt — resume if found
    if (existingAttempts.length > 0) {
      // Sort by attemptNumber descending, find most recent
      const sorted = [...existingAttempts].sort(
        (a, b) => b.attemptNumber - a.attemptNumber,
      );
      const lastAttempt = sorted[0];

      if (lastAttempt.exitType === "suspend") {
        const previousState = await store.cmiState
          .findOne(lastAttempt.id)
          .exec();

        if (previousState) {
          const restored: Partial<CmiData> = {};
          if (previousState.lessonLocation) {
            restored.lessonLocation = previousState.lessonLocation;
          }
          if (previousState.lessonStatus) {
            restored.lessonStatus = previousState
              .lessonStatus as CmiData["lessonStatus"];
          }
          if (previousState.suspendData) {
            restored.suspendData = previousState.suspendData;
          }
          if (
            previousState.scoreRaw !== undefined &&
            previousState.scoreRaw !== null
          ) {
            restored.scoreRaw = previousState.scoreRaw;
          }
          if (
            previousState.scoreMin !== undefined &&
            previousState.scoreMin !== null
          ) {
            restored.scoreMin = previousState.scoreMin;
          }
          if (
            previousState.scoreMax !== undefined &&
            previousState.scoreMax !== null
          ) {
            restored.scoreMax = previousState.scoreMax;
          }
          if (previousState.totalTime) {
            restored.totalTime = previousState.totalTime;
          }
          if (previousState.objectives) {
            restored.objectives = JSON.parse(previousState.objectives);
          }
          if (previousState.interactions) {
            restored.interactions = JSON.parse(previousState.interactions);
          }

          runtime.loadState(restored);
        }
      }
    }

    // 5. Wire onCommit to persist state
    runtime.onCommit = async (state: CmiData) => {
      await persistState(state);
    };
  }

  async function persistState(state: CmiData): Promise<void> {
    // Upsert cmi_state
    const existing = await store.cmiState.findOne(attemptId).exec();
    const cmiDoc = {
      attemptId,
      lessonLocation: state.lessonLocation,
      lessonStatus: state.lessonStatus,
      suspendData: state.suspendData,
      scoreRaw: state.scoreRaw ?? undefined,
      scoreMin: state.scoreMin ?? undefined,
      scoreMax: state.scoreMax ?? undefined,
      totalTime: state.totalTime,
      objectives: state.objectives.length > 0
        ? JSON.stringify(state.objectives)
        : undefined,
      interactions: state.interactions.length > 0
        ? JSON.stringify(state.interactions)
        : undefined,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await existing.patch({
        lessonLocation: cmiDoc.lessonLocation,
        lessonStatus: cmiDoc.lessonStatus,
        suspendData: cmiDoc.suspendData,
        scoreRaw: cmiDoc.scoreRaw,
        scoreMin: cmiDoc.scoreMin,
        scoreMax: cmiDoc.scoreMax,
        totalTime: cmiDoc.totalTime,
        objectives: cmiDoc.objectives,
        interactions: cmiDoc.interactions,
        updatedAt: cmiDoc.updatedAt,
      });
    } else {
      await store.cmiState.insert(cmiDoc);
    }

    // Update attempt score/status
    const attemptDoc = await store.attempts.findOne(attemptId).exec();
    if (attemptDoc) {
      await attemptDoc.patch({
        status: state.lessonStatus,
        scoreRaw: state.scoreRaw ?? undefined,
        scoreMin: state.scoreMin ?? undefined,
        scoreMax: state.scoreMax ?? undefined,
        exitType: state.exit || undefined,
      });
    }

    // Update enrollment status based on lesson_status
    const enrollmentDoc = await store.enrollments
      .findOne(enrollmentId)
      .exec();
    if (enrollmentDoc) {
      const enrollmentStatus = mapLessonStatusToEnrollment(state.lessonStatus);
      const patch: Record<string, unknown> = { status: enrollmentStatus };
      if (
        enrollmentStatus === "completed" && !enrollmentDoc.completedAt
      ) {
        patch.completedAt = new Date().toISOString();
      }
      await enrollmentDoc.patch(patch);
    }
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;

    // Final commit if not already finished
    try {
      runtime.finish();
    } catch {
      // Already finished — that's fine
    }
  }

  return {
    initialize,
    dispose,
    get enrollmentId() {
      return enrollmentId;
    },
    get attemptId() {
      return attemptId;
    },
    get attemptNumber() {
      return attemptNumber;
    },
  };
}

function mapLessonStatusToEnrollment(
  lessonStatus: string,
): "enrolled" | "in_progress" | "completed" {
  switch (lessonStatus) {
    case "completed":
    case "passed":
      return "completed";
    case "not attempted":
      return "enrolled";
    default:
      return "in_progress";
  }
}
