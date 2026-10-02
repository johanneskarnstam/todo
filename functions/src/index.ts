/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {
  getReminderAt,
  isReminderEligible,
  type ReminderTaskSnapshot,
} from "./reminderJobs.js";
import {onSchedule} from "firebase-functions/scheduler";
import {processDueReminderJobs} from "./delivery.js";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10, region: "europe-west1"});

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

export const syncReminderJob = onDocumentWritten(
  "users/{userId}/tasks/{taskId}",
  async (event) => {
    const after = event.data?.after;
    const userId = event.params.userId;
    const taskId = event.params.taskId;
    const jobReference = db.doc(`users/${userId}/reminderJobs/${taskId}`);

    if (!after?.exists) {
      const taskReference = db.doc(`users/${userId}/tasks/${taskId}`);
      if (!(await taskReference.get()).exists) {
        await cancelReminderJob(jobReference);
        await db.recursiveDelete(taskReference);
      }
      return;
    }

    const task = after.data() as ReminderTaskSnapshot;
    const reminderAt = getReminderAt(task);
    if (!isReminderEligible(task) || !reminderAt) {
      await cancelReminderJob(jobReference);
      return;
    }

    const now = new Date().toISOString();
    const revision = after.updateTime?.toMillis().toString() ?? event.id;
    const synchronized = await db.runTransaction(async (transaction) => {
      const currentJob = await transaction.get(jobReference);
      const currentRevision = currentJob.get("revision");
      if (isOlderRevision(revision, currentRevision)) {
        return false;
      }

      transaction.set(jobReference, {
        id: jobReference.id,
        userId,
        taskId,
        revision,
        reminderAt,
        status: "pending",
        attempts: 0,
        createdAt: currentJob.get("createdAt") ?? now,
        updatedAt: now,
      });
      return true;
    });

    if (synchronized) {
      logger.info("Reminder job synchronized", {
        jobId: jobReference.id,
        status: "pending",
      });
    }
  },
);

export const processReminderJobs = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "Europe/Stockholm",
}, async () => processDueReminderJobs());

/**
 * Returns whether an incoming task event is older than the stored revision.
 * @param {string} incomingRevision Event revision.
 * @param {unknown} currentRevision Stored revision.
 * @return {boolean} Whether the incoming event should be ignored.
 */
function isOlderRevision(
  incomingRevision: string,
  currentRevision: unknown,
): boolean {
  if (typeof currentRevision !== "string") return false;
  const incomingTime = Number(incomingRevision);
  const currentTime = Number(currentRevision);
  return Number.isFinite(incomingTime) &&
    Number.isFinite(currentTime) && incomingTime < currentTime;
}

/**
 * Marks an existing reminder job as cancelled without deleting its history.
 * @param {FirebaseFirestore.DocumentReference} jobReference Job document.
 * @param {string} revision Optional task revision.
 * @return {Promise<void>} Completion promise.
 */
async function cancelReminderJob(
  jobReference: FirebaseFirestore.DocumentReference,
  revision?: string,
): Promise<void> {
  const cancelled = await db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobReference);
    if (!jobSnapshot.exists ||
      (revision && isOlderRevision(revision, jobSnapshot.get("revision")))) {
      return false;
    }

    transaction.set(jobReference, {
      status: "cancelled",
      updatedAt: new Date().toISOString(),
    }, {merge: true});
    return true;
  });

  if (cancelled) {
    logger.info("Reminder job cancelled", {
      jobId: jobReference.id,
      status: "cancelled",
    });
  }
}
