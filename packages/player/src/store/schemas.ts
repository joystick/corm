import type { RxJsonSchema } from "rxdb";

export interface Enrollment {
  id: string;
  learnerId: string;
  courseId: string;
  status: "enrolled" | "in_progress" | "completed";
  enrolledAt: string;
  completedAt?: string;
}

export const enrollmentSchema: RxJsonSchema<Enrollment> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 255 },
    learnerId: { type: "string" },
    courseId: { type: "string" },
    status: { type: "string", enum: ["enrolled", "in_progress", "completed"] },
    enrolledAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "learnerId", "courseId", "status", "enrolledAt"],
};

export interface Attempt {
  id: string;
  enrollmentId: string;
  attemptNumber: number;
  startedAt: string;
  duration?: number;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  status: string;
  exitType?: string;
}

export const attemptSchema: RxJsonSchema<Attempt> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 255 },
    enrollmentId: { type: "string" },
    attemptNumber: { type: "number" },
    startedAt: { type: "string", format: "date-time" },
    duration: { type: "number" },
    scoreRaw: { type: "number" },
    scoreMin: { type: "number" },
    scoreMax: { type: "number" },
    status: { type: "string" },
    exitType: { type: "string" },
  },
  required: ["id", "enrollmentId", "attemptNumber", "startedAt", "status"],
};

export interface CmiState {
  attemptId: string;
  lessonLocation?: string;
  lessonStatus?: string;
  suspendData?: string;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  totalTime?: string;
  objectives?: string;
  interactions?: string;
  updatedAt?: string;
}

export const cmiStateSchema: RxJsonSchema<CmiState> = {
  version: 0,
  primaryKey: "attemptId",
  type: "object",
  properties: {
    attemptId: { type: "string", maxLength: 255 },
    lessonLocation: { type: "string" },
    lessonStatus: { type: "string" },
    suspendData: { type: "string" },
    scoreRaw: { type: "number" },
    scoreMin: { type: "number" },
    scoreMax: { type: "number" },
    totalTime: { type: "string" },
    objectives: { type: "string" },
    interactions: { type: "string" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["attemptId"],
};

export interface Interaction {
  id: string;
  attemptId: string;
  index: number;
  interactionId?: string;
  type?: string;
  timestamp: string;
  learnerResponse?: string;
  result?: string;
  latency?: string;
  description?: string;
  correctResponses?: string;
  hashChain?: string;
}

export const interactionSchema: RxJsonSchema<Interaction> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 255 },
    attemptId: { type: "string" },
    index: { type: "number" },
    interactionId: { type: "string" },
    type: { type: "string" },
    timestamp: { type: "string" },
    learnerResponse: { type: "string" },
    result: { type: "string" },
    latency: { type: "string" },
    description: { type: "string" },
    correctResponses: { type: "string" },
    hashChain: { type: "string" },
  },
  required: ["id", "attemptId", "index", "timestamp"],
};

export interface SyncQueueItem {
  id: string;
  collectionName: string;
  docId: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  payload: string;
  timestamp: string;
  isSynced?: boolean;
}

export const syncQueueSchema: RxJsonSchema<SyncQueueItem> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 255 },
    collectionName: { type: "string" },
    docId: { type: "string" },
    operation: { type: "string", enum: ["INSERT", "UPDATE", "DELETE"] },
    payload: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
    isSynced: { type: "boolean" },
  },
  required: [
    "id",
    "collectionName",
    "docId",
    "operation",
    "payload",
    "timestamp",
  ],
};
