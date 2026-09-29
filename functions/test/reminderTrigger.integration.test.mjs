import assert from "node:assert/strict";
import test from "node:test";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import firebaseFunctionsTest from "firebase-functions-test";

process.env.GCLOUD_PROJECT ??= "demo-todo";
initializeApp({projectId: process.env.GCLOUD_PROJECT});

const firestore = getFirestore();
const functionsTest = firebaseFunctionsTest({
  projectId: process.env.GCLOUD_PROJECT,
});
const {syncReminderJob} = await import("../lib/index.js");
const wrappedSyncReminderJob = functionsTest.wrap(syncReminderJob);

const taskPath = "users/user-1/tasks/task-1";
const jobPath = "users/user-1/reminderJobs/task-1";
const activeTask = {
  userId: "user-1",
  taskId: "task-1",
  title: "Integration reminder",
  dueDate: "2026-10-01",
  dueTimeZone: "Europe/Stockholm",
  reminder: {offsetMinutes: 10},
  completed: false,
  status: "todo",
};

async function invokeTaskChange(beforeData, afterData, updateTime) {
  const before = functionsTest.firestore.makeDocumentSnapshot(
    beforeData ?? {},
    taskPath,
  );
  const after = functionsTest.firestore.makeDocumentSnapshot(
    afterData ?? {},
    taskPath,
    updateTime ? {updateTime} : undefined,
  );
  await wrappedSyncReminderJob({
    data: {before, after},
    params: {userId: "user-1", taskId: "task-1"},
    id: "integration-event",
  });
}

test("syncs and cancels a reminder job in Firestore emulator", async () => {
  await firestore.doc(jobPath).delete();
  await invokeTaskChange({}, activeTask);

  const createdJob = await firestore.doc(jobPath).get();
  assert.equal(createdJob.get("status"), "pending");
  assert.equal(createdJob.get("reminderAt"), "2026-10-01T06:50:00.000Z");

  await invokeTaskChange(activeTask, {...activeTask, completed: true});
  const cancelledJob = await firestore.doc(jobPath).get();
  assert.equal(cancelledJob.get("status"), "cancelled");
});

test("ignores an older task event", async () => {
  await firestore.doc(jobPath).delete();
  await invokeTaskChange({}, activeTask, "2026-10-01T10:01:00.000Z");
  await invokeTaskChange(
    activeTask,
    {...activeTask, title: "Older event"},
    "2026-10-01T10:00:00.000Z",
  );

  const currentJob = await firestore.doc(jobPath).get();
  assert.equal(currentJob.get("revision"), "1790848860000");
});
