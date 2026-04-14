/**
 * CMI data model interfaces — the SCORM state shape.
 */

export const VALID_LESSON_STATUSES = [
  "not attempted",
  "incomplete",
  "completed",
  "passed",
  "failed",
] as const;

export type LessonStatus = (typeof VALID_LESSON_STATUSES)[number];

export const VALID_EXIT_VALUES = ["", "suspend", "logout", "normal"] as const;

export type ExitValue = (typeof VALID_EXIT_VALUES)[number];

export interface CmiObjective {
  id: string;
  status: string;
  scoreRaw: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
}

export interface CmiInteraction {
  id: string;
  type: string;
  timestamp: string;
  learnerResponse: string;
  result: string;
  latency: string;
  description: string;
  correctResponses: string[];
}

export interface CmiData {
  // Core
  studentId: string;
  studentName: string;
  lessonLocation: string;
  lessonStatus: LessonStatus;
  exit: ExitValue;

  // Score
  scoreRaw: number | null;
  scoreMin: number | null;
  scoreMax: number | null;

  // Time
  sessionTime: string;
  totalTime: string;

  // Data
  suspendData: string;

  // Collections
  objectives: CmiObjective[];
  interactions: CmiInteraction[];
}

export function createDefaultCmiData(): CmiData {
  return {
    studentId: "",
    studentName: "",
    lessonLocation: "",
    lessonStatus: "not attempted",
    exit: "",
    scoreRaw: null,
    scoreMin: null,
    scoreMax: null,
    sessionTime: "PT0S",
    totalTime: "PT0S",
    suspendData: "",
    objectives: [],
    interactions: [],
  };
}
