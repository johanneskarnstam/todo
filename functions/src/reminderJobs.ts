import type {Timestamp} from "firebase-admin/firestore";

export const reminderJobStatuses = [
  "pending",
  "processing",
  "sent",
  "cancelled",
  "failed",
] as const;

export type ReminderJobStatus = (typeof reminderJobStatuses)[number];

/**
 * Returns whether server-side push delivery is enabled.
 * @return {boolean} False unless explicitly enabled in the server environment.
 */
export function isReminderDeliveryEnabled(): boolean {
  return process.env.PUSH_REMINDERS_ENABLED === "true";
}

export type ReminderMode = "relative" | "absolute";

export interface RelativeReminder {
  mode: "relative";
  offsetMinutes: number;
}

export interface AbsoluteReminder {
  mode: "absolute";
  at: string;
  timeZone: string;
}

export type TaskReminder = RelativeReminder | AbsoluteReminder;

export interface ReminderTaskSnapshot {
  userId: string;
  taskId: string;
  title: string;
  dueDate?: string | Timestamp | null;
  dueTimeZone?: string | null;
  reminder?: {offsetMinutes: 0 | 10 | 60 | 1440} | RelativeReminder | null;
  reminders?: TaskReminder[] | null;
  completed?: boolean;
  status?: "todo" | "inProgress" | "completed";
}

export interface ReminderJob {
  id: string;
  userId: string;
  taskId: string;
  reminderIndex?: number;
  revision: string;
  reminderAt: string;
  status: ReminderJobStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export const reminderDeliveryMaxAgeMs = 15 * 60 * 1000;

/**
 * Returns whether a due reminder is too old to deliver.
 * @param {string} reminderAt Reminder instant as ISO timestamp.
 * @param {number} now Current time in milliseconds.
 * @return {boolean} Whether delivery should be skipped.
 */
export function isReminderTooOld(reminderAt: string, now: number): boolean {
  const reminderTime = Date.parse(reminderAt);
  return !Number.isFinite(reminderTime) ||
    now - reminderTime > reminderDeliveryMaxAgeMs;
}

/**
 * Returns the stable document ID used for one task revision.
 * @param {string} userId Firebase user ID.
 * @param {string} taskId Firestore task ID.
 * @param {string} revision Task revision identifier.
 * @return {string} Stable reminder job document ID.
 */
export function getReminderJobId(
  userId: string,
  taskId: string,
  revision: string,
): string {
  return [userId, taskId, revision].map(encodeURIComponent).join("_");
}

/**
 * Returns whether a task contains the fields required for a reminder job.
 * @param {ReminderTaskSnapshot} task Current task data.
 * @return {boolean} Whether the task can produce a reminder job.
 */
export function isReminderEligible(
  task: ReminderTaskSnapshot,
): boolean {
  if (
    !task.dueDate ||
    !task.reminder ||
    task.completed ||
    task.status === "completed"
  ) {
    return false;
  }

  if (typeof task.dueDate === "string" && !task.dueTimeZone) {
    return false;
  }

  if (task.dueTimeZone) {
    try {
      new Intl.DateTimeFormat("en-US", {timeZone: task.dueTimeZone}).format();
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Calculates the reminder instant as an ISO timestamp.
 * @param {ReminderTaskSnapshot} task Current task data.
 * @return {string | null} Reminder instant, or null for invalid data.
 */
export function getReminderAt(task: ReminderTaskSnapshot): string | null {
  if (!isReminderEligible(task) || !task.reminder || !task.dueDate) {
    return null;
  }

  const dueDate = getDueDate(task.dueDate, task.dueTimeZone);
  if (!dueDate) {
    return null;
  }

  dueDate.setUTCMinutes(dueDate.getUTCMinutes() - task.reminder.offsetMinutes);
  return dueDate.toISOString();
}

/**
 * Converts a task due date into an absolute instant.
 * @param {string | Timestamp} dueDate Task due date.
 * @param {string | null} timeZone IANA timezone for date-only values.
 * @return {Date | null} Absolute due date, or null for invalid input.
 */
function getDueDate(
  dueDate: string | Timestamp,
  timeZone?: string | null,
): Date | null {
  if (typeof dueDate !== "string") {
    return dueDate.toDate();
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(dueDate);
  if (!timeZone || !match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] === undefined ? 9 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day ||
    hour > 23 || minute > 59) {
    return null;
  }

  const candidate = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const candidateParts = formatter.formatToParts(new Date(candidate));
  const candidateValues = new Map(
    candidateParts.map((part) => [part.type, part.value]),
  );
  const localCandidate = Date.UTC(
    Number(candidateValues.get("year")),
    Number(candidateValues.get("month")) - 1,
    Number(candidateValues.get("day")),
    Number(candidateValues.get("hour")),
    Number(candidateValues.get("minute")),
    Number(candidateValues.get("second")),
  );
  const resolvedDate = new Date(candidate + candidate - localCandidate);
  const resolvedParts = formatter.formatToParts(resolvedDate);
  const resolvedValues = new Map(
    resolvedParts.map((part) => [part.type, part.value]),
  );

  if (Number(resolvedValues.get("year")) !== year ||
    Number(resolvedValues.get("month")) !== month ||
    Number(resolvedValues.get("day")) !== day ||
    Number(resolvedValues.get("hour")) !== hour ||
    Number(resolvedValues.get("minute")) !== minute) {
    return null;
  }

  return resolvedDate;
}
