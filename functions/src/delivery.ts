import {
  getMessaging,
  type BatchResponse,
  type MulticastMessage,
  type SendResponse,
} from "firebase-admin/messaging";
import {getApps, initializeApp} from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  getReminderAt,
  isReminderDeliveryEnabled,
  isReminderEligible,
  isReminderTooOld,
  type ReminderJob,
  type ReminderTaskSnapshot,
} from "./reminderJobs.js";

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();
const maxJobsPerRun = 50;
const maxDeliveryAttempts = 3;
const retryBaseDelayMs = 60_000;
export type ReminderSender = (message: MulticastMessage) =>
  Promise<BatchResponse>;

/**
 * Processes due jobs only when the server kill switch is enabled.
 * @param {ReminderSender} send FCM delivery adapter.
 * @return {Promise<void>} Completion promise.
 */
export async function processDueReminderJobs(
  send: ReminderSender = sendWithFcm,
): Promise<void> {
  if (!isReminderDeliveryEnabled()) {
    logger.info("Reminder delivery is disabled", {status: "disabled"});
    return;
  }

  const now = Date.now();
  const dueJobs = await db.collectionGroup("reminderJobs")
    .where("status", "==", "pending")
    .where("reminderAt", "<=", new Date(now).toISOString())
    .limit(maxJobsPerRun)
    .get();

  for (const jobSnapshot of dueJobs.docs) {
    await processReminderJob(
      jobSnapshot.ref,
      jobSnapshot.data() as ReminderJob,
      now,
      send,
    );
  }
}

/**
 * Claims and delivers one reminder job.
 * @param {DocumentReference} jobReference Job document.
 * @param {ReminderJob} initialJob Job data from the due-job query.
 * @param {number} now Current time in milliseconds.
 * @param {ReminderSender} send FCM delivery adapter.
 */
async function processReminderJob(
  jobReference: DocumentReference,
  initialJob: ReminderJob,
  now: number,
  send: ReminderSender,
): Promise<void> {
  const claimed = await claimReminderJob(jobReference, initialJob, now);
  if (!claimed) return;

  try {
    const taskReference = db.doc(
      `users/${initialJob.userId}/tasks/${initialJob.taskId}`,
    );
    const taskSnapshot = await taskReference.get();
    const task = taskSnapshot.data() as ReminderTaskSnapshot | undefined;
    const currentRevision = taskSnapshot.updateTime?.toMillis().toString();

    const reminderIndex = initialJob.reminderIndex ?? 0;
    if (!task || currentRevision !== initialJob.revision ||
      !isReminderEligible(task, reminderIndex) ||
      getReminderAt(task, reminderIndex) !== initialJob.reminderAt) {
      await markJob(jobReference, "cancelled", "task_changed");
      return;
    }

    const devices = await db.collection(
      `users/${initialJob.userId}/devices`,
    ).where("enabled", "==", true).get();
    const devicesByToken = new Map<
      string,
      FirebaseFirestore.QueryDocumentSnapshot[]
    >();
    for (const device of devices.docs) {
      const token = device.get("token");
      if (typeof token !== "string" || token.length === 0) continue;
      const matchingDevices = devicesByToken.get(token) ?? [];
      matchingDevices.push(device);
      devicesByToken.set(token, matchingDevices);
    }
    const tokens = Array.from(devicesByToken.keys());

    if (tokens.length === 0) {
      await markJob(jobReference, "failed", "no_active_devices");
      return;
    }

    const message: MulticastMessage = {
      tokens,
      data: {
        taskId: initialJob.taskId,
        title: task.title,
        body: task.title,
      },
    };
    const response = await send(message);

    await removeInvalidTokens(
      Array.from(devicesByToken.values()),
      response.responses,
    );
    await markJob(
      jobReference,
      response.successCount > 0 ? "sent" : "failed",
      response.successCount > 0 ? undefined : "fcm_delivery_failed",
    );
  } catch (error) {
    const attempts = initialJob.attempts + 1;
    const status = attempts < maxDeliveryAttempts ? "pending" : "failed";
    const errorCode = getErrorCode(error);
    await markJob(jobReference, status, errorCode);
    logger.warn("Reminder delivery attempt failed", {
      jobId: jobReference.id,
      status,
      attempts,
      errorCode,
    });
  }
}

/**
 * Returns a non-sensitive error code for delivery logs.
 * @param {unknown} error Delivery error.
 * @return {string} Error code or a generic fallback.
 */
function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string") {
    return error.code;
  }
  return "unknown";
}

/**
 * Sends a multicast message through the Firebase Admin SDK.
 * @param {MulticastMessage} message FCM message.
 * @return {Promise<BatchResponse>} Firebase send response.
 */
const sendWithFcm: ReminderSender = (message) =>
  getMessaging().sendEachForMulticast(message);

/**
 * Atomically claims a pending job or marks it expired.
 * @param {DocumentReference} jobReference Job document.
 * @param {ReminderJob} initialJob Job data from the due-job query.
 * @param {number} now Current time in milliseconds.
 * @return {Promise<boolean>} Whether the job was claimed.
 */
async function claimReminderJob(
  jobReference: DocumentReference,
  initialJob: ReminderJob,
  now: number,
): Promise<boolean> {
  let claimed = false;
  await db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(jobReference);
    const currentJob = currentSnapshot.data() as ReminderJob | undefined;
    if (!currentJob || currentJob.status !== "pending" ||
      currentJob.revision !== initialJob.revision) return;

    const attempts = currentJob.attempts ?? 0;
    const updatedAt = Date.parse(currentJob.updatedAt);
    const retryDelayMs = retryBaseDelayMs * 2 ** Math.max(0, attempts - 1);
    if (attempts > 0 && Number.isFinite(updatedAt) &&
      now - updatedAt < retryDelayMs) return;

    if (isReminderTooOld(currentJob.reminderAt, now)) {
      transaction.update(jobReference, {
        status: "cancelled",
        updatedAt: new Date(now).toISOString(),
        lastError: "expired",
      });
      return;
    }

    transaction.update(jobReference, {
      status: "processing",
      attempts: FieldValue.increment(1),
      updatedAt: new Date(now).toISOString(),
    });
    claimed = true;
  });
  return claimed;
}

/**
 * Updates a job status without deleting its history.
 * @param {DocumentReference} jobReference Job document.
 * @param {"sent" | "cancelled" | "failed"} status New status.
 * @param {string} lastError Optional error classification.
 * @return {Promise<void>} Completion promise.
 */
async function markJob(
  jobReference: DocumentReference,
  status: "pending" | "sent" | "cancelled" | "failed",
  lastError?: string,
): Promise<void> {
  await jobReference.set({
    status,
    updatedAt: new Date().toISOString(),
    ...(lastError ? {lastError} : {}),
  }, {merge: true});
}

/**
 * Removes FCM tokens that Firebase reports as permanently invalid.
 * @param {Array} devicesByToken Device documents grouped by token.
 * @param {SendResponse[]} responses FCM response entries.
 * @return {Promise<void>} Completion promise.
 */
async function removeInvalidTokens(
  devicesByToken: FirebaseFirestore.QueryDocumentSnapshot[][],
  responses: SendResponse[],
): Promise<void> {
  const invalidTokenCodes = new Set([
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
  ]);
  const invalidDevices = devicesByToken.filter((_devices, index) => {
    const errorCode = responses[index].error?.code;
    return errorCode !== undefined && invalidTokenCodes.has(errorCode);
  });

  if (invalidDevices.length === 0) return;
  const batch = db.batch();
  for (const devices of invalidDevices) {
    for (const device of devices) batch.delete(device.ref);
  }
  await batch.commit();
}
