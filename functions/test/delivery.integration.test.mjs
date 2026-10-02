import assert from "node:assert/strict";
import test from "node:test";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT ??= "demo-todo";
process.env.PUSH_REMINDERS_ENABLED = "true";
initializeApp({projectId: process.env.GCLOUD_PROJECT});

const firestore = getFirestore();
const {processDueReminderJobs} = await import("../lib/delivery.js");

test("claims and marks a due job sent through the mock adapter", async () => {
  const taskReference = firestore.doc("users/user-1/tasks/task-delivery");
  const jobReference = firestore.doc("users/user-1/reminderJobs/task-delivery");
  const deviceReference = firestore.doc("users/user-1/devices/device-delivery");
  const reminderAt = new Date(Date.now() - 60_000);

  await taskReference.set({
    title: "Mock delivery task",
    dueDate: Timestamp.fromDate(reminderAt),
    reminder: {offsetMinutes: 0},
    completed: false,
    status: "todo",
  });
  const taskSnapshot = await taskReference.get();
  await deviceReference.set({enabled: true, token: "mock-token"});
  await jobReference.set({
    id: jobReference.id,
    userId: "user-1",
    taskId: "task-delivery",
    revision: taskSnapshot.updateTime.toMillis().toString(),
    reminderAt: reminderAt.toISOString(),
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  let deliveredMessage;
  await processDueReminderJobs(async (message) => {
    deliveredMessage = message;
    return {
      successCount: 1,
      failureCount: 0,
      responses: [{success: true, messageId: "mock-message"}],
    };
  });

  const deliveredJob = await jobReference.get();
  assert.equal(
    deliveredJob.get("status"),
    "sent",
    JSON.stringify(deliveredJob.data()),
  );
  assert.equal(deliveredMessage.tokens[0], "mock-token");
  assert.equal(deliveredMessage.data.taskId, "task-delivery");
  assert.equal(deliveredMessage.notification, undefined);
  assert.equal(deliveredMessage.data.title, "Påminnelse: Mock delivery task");
  assert.equal(
    deliveredMessage.data.body,
    "Mock delivery task",
  );

  await Promise.all([
    taskReference.delete(),
    jobReference.delete(),
    deviceReference.delete(),
  ]);
});

test("retries a failed delivery after the backoff", async () => {
  const taskReference = firestore.doc("users/user-1/tasks/task-retry");
  const jobReference = firestore.doc("users/user-1/reminderJobs/task-retry");
  const deviceReference = firestore.doc("users/user-1/devices/device-retry");
  const reminderAt = new Date(Date.now() - 60_000);

  await taskReference.set({
    title: "Retry delivery task",
    dueDate: Timestamp.fromDate(reminderAt),
    reminder: {offsetMinutes: 0},
    completed: false,
    status: "todo",
  });
  const taskSnapshot = await taskReference.get();
  await deviceReference.set({enabled: true, token: "mock-retry-token"});
  await jobReference.set({
    id: jobReference.id,
    userId: "user-1",
    taskId: "task-retry",
    revision: taskSnapshot.updateTime.toMillis().toString(),
    reminderAt: reminderAt.toISOString(),
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await processDueReminderJobs(async () => {
    throw Object.assign(new Error("temporary failure"), {
      code: "messaging/server-unavailable",
    });
  });

  const retryableJob = await jobReference.get();
  assert.equal(retryableJob.get("status"), "pending");
  assert.equal(retryableJob.get("attempts"), 1);
  assert.equal(
    retryableJob.get("lastError"),
    "messaging/server-unavailable",
  );

  await jobReference.update({
    updatedAt: new Date(Date.now() - 120_000).toISOString(),
  });
  await processDueReminderJobs(async () => ({
    successCount: 1,
    failureCount: 0,
    responses: [{success: true, messageId: "retry-success"}],
  }));

  const deliveredJob = await jobReference.get();
  assert.equal(deliveredJob.get("status"), "sent");
  assert.equal(deliveredJob.get("attempts"), 2);

  await Promise.all([
    taskReference.delete(),
    jobReference.delete(),
    deviceReference.delete(),
  ]);
});
