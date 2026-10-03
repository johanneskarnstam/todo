import {readFileSync} from "node:fs";
import test from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {deleteField, doc, getDoc, setDoc, updateDoc, writeBatch} from "firebase/firestore";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const testEnvironment = await initializeTestEnvironment({
  projectId: "demo-todo",
  firestore: {rules},
});

const aiBreakdown = (overrides = {}) => ({
  schemaVersion: 1,
  modelId: "gemini-3.8-flash",
  sourceTitle: "Måla sovrummet",
  sourceNote: "Väggen behöver grundmålas.",
  sourcePrompt: "Dela upp arbetet över två dagar.",
  generatedAt: new Date(),
  suggestionCount: 1,
  suggestionIds: ["suggestion-1"],
  ...overrides,
});

const createTask = async (userId, taskId) => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${userId}/tasks/${taskId}`), {
      title: "Parent task",
    });
  });
};

test.after(async () => {
  await testEnvironment.cleanup();
});

test("allows a user to write only their own task", async () => {
  const userDb = testEnvironment.authenticatedContext("user-1").firestore();
  const ownTask = doc(userDb, "users/user-1/tasks/task-1");
  const otherTask = doc(userDb, "users/user-2/tasks/task-1");

  await assertSucceeds(setDoc(ownTask, {title: "Own task"}));
  await assertFails(setDoc(otherTask, {title: "Other task"}));
});

test("allows a user to read and write only their own settings", async () => {
  const userDb = testEnvironment.authenticatedContext("user-1").firestore();
  const ownSettings = doc(userDb, "users/user-1/settings/aiKeys");
  const otherSettings = doc(userDb, "users/user-2/settings/aiKeys");

  await assertSucceeds(setDoc(ownSettings, {keys: [], selectedKeyId: "auto"}));
  await assertFails(setDoc(otherSettings, {keys: [], selectedKeyId: "auto"}));
});

test("denies unauthenticated task access", async () => {
  const anonymousDb = testEnvironment.unauthenticatedContext().firestore();
  const task = doc(anonymousDb, "users/user-1/tasks/task-1");

  await assertFails(getDoc(task));
  await assertFails(setDoc(task, {title: "Blocked task"}));
});

test("denies all client access to reminder jobs", async () => {
  const userDb = testEnvironment.authenticatedContext("user-1").firestore();
  const job = doc(userDb, "users/user-1/reminderJobs/task-1");

  await assertFails(getDoc(job));
  await assertFails(setDoc(job, {status: "pending"}));
});

test("allows device registration but prevents ownership changes", async () => {
  const userDb = testEnvironment.authenticatedContext("user-1").firestore();
  const ownDevice = doc(userDb, "users/user-1/devices/device-1");
  const otherDevice = doc(userDb, "users/user-2/devices/device-1");

  await assertSucceeds(setDoc(ownDevice, {userId: "user-1", enabled: true}));
  await assertFails(setDoc(
    ownDevice,
    {userId: "user-2", enabled: true},
    {merge: true},
  ));
  await assertFails(setDoc(otherDevice, {userId: "user-2", enabled: true}));
});

test("allows an owner to create latest AI breakdown and bounded suggestion documents atomically", async () => {
  await createTask("user-1", "ai-task-1");
  const userDb = testEnvironment.authenticatedContext("user-1").firestore();
  const latest = doc(userDb, "users/user-1/tasks/ai-task-1/aiBreakdowns/latest");
  const suggestion = doc(
    userDb,
    "users/user-1/tasks/ai-task-1/aiBreakdowns/latest/suggestions/suggestion-1",
  );
  const batch = writeBatch(userDb);
  batch.set(latest, aiBreakdown());
  batch.set(suggestion, {title: "Köp färg", order: 0, status: "available"});

  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(latest));
  await assertSucceeds(getDoc(suggestion));
});

test("denies unauthenticated and cross-user AI breakdown access", async () => {
  await createTask("user-1", "ai-task-2");
  const ownerDb = testEnvironment.authenticatedContext("user-1").firestore();
  const ownerLatest = doc(ownerDb, "users/user-1/tasks/ai-task-2/aiBreakdowns/latest");
  await assertSucceeds(setDoc(ownerLatest, aiBreakdown()));

  const otherDb = testEnvironment.authenticatedContext("user-2").firestore();
  const otherLatest = doc(otherDb, "users/user-1/tasks/ai-task-2/aiBreakdowns/latest");
  const otherSuggestion = doc(
    otherDb,
    "users/user-1/tasks/ai-task-2/aiBreakdowns/latest/suggestions/suggestion-1",
  );
  await assertFails(getDoc(otherLatest));
  await assertFails(setDoc(otherLatest, aiBreakdown()));
  await assertFails(getDoc(otherSuggestion));
  await assertFails(setDoc(otherSuggestion, {title: "Köp färg", status: "available"}));

  const anonymousDb = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonymousDb, "users/user-1/tasks/ai-task-2/aiBreakdowns/latest")));
});

test("rejects malformed AI metadata, invalid suggestions, and arbitrary fields", async () => {
  await createTask("user-1", "ai-task-3");
  const userDb = testEnvironment.authenticatedContext("user-1").firestore();
  const latest = doc(userDb, "users/user-1/tasks/ai-task-3/aiBreakdowns/latest");

  await assertFails(setDoc(latest, aiBreakdown({modelId: "unlisted-model"})));
  await assertFails(setDoc(latest, aiBreakdown({sourceNote: "x".repeat(4001)})));
  await assertFails(setDoc(latest, aiBreakdown({extraData: "not allowed"})));
  await assertSucceeds(setDoc(latest, aiBreakdown()));

  const suggestions = "users/user-1/tasks/ai-task-3/aiBreakdowns/latest/suggestions";
  await assertFails(setDoc(doc(userDb, `${suggestions}/too-long`), {
    title: "x".repeat(181),
    order: 0,
    status: "available",
  }));
  await assertFails(setDoc(doc(userDb, `${suggestions}/unknown-state`), {
    title: "Köp färg",
    order: 0,
    status: "pending",
  }));
  await assertFails(setDoc(doc(userDb, `${suggestions}/arbitrary-field`), {
    title: "Köp färg",
    order: 0,
    status: "available",
    extraData: true,
  }));
  await assertFails(setDoc(doc(userDb, `${suggestions}/unlisted-id`), {
    title: "Köp färg",
    order: 0,
    status: "available",
  }));
  await assertFails(setDoc(latest, aiBreakdown({
    suggestionCount: 21,
    suggestionIds: Array.from({length: 21}, (_, index) => `suggestion-${index}`),
  })));
  await assertFails(setDoc(doc(userDb, `${suggestions}/added-without-step`), {
    title: "Köp färg",
    status: "added",
  }));
});

test("allows only valid suggestion state changes without changing its title", async () => {
  await createTask("user-1", "ai-task-4");
  const userDb = testEnvironment.authenticatedContext("user-1").firestore();
  const latest = doc(userDb, "users/user-1/tasks/ai-task-4/aiBreakdowns/latest");
  await assertSucceeds(setDoc(latest, aiBreakdown()));

  const suggestion = doc(
    userDb,
    "users/user-1/tasks/ai-task-4/aiBreakdowns/latest/suggestions/suggestion-1",
  );
  await assertSucceeds(setDoc(suggestion, {title: "Köp färg", order: 0, status: "available"}));
  await assertFails(updateDoc(suggestion, {title: "Ändra förslag"}));
  await assertFails(updateDoc(suggestion, {status: "added"}));
  await assertSucceeds(updateDoc(suggestion, {status: "skipped"}));
  const step = doc(userDb, "users/user-1/tasks/ai-task-4/steps/step-1");
  const batch = writeBatch(userDb);
  batch.set(step, {title: "Köp färg", taskId: "ai-task-4"});
  batch.update(suggestion, {status: "added", stepId: "step-1"});
  await assertSucceeds(batch.commit());

  await assertFails(updateDoc(suggestion, {
    status: "available",
    stepId: deleteField(),
  }));

  const deleteBatch = writeBatch(userDb);
  deleteBatch.delete(step);
  deleteBatch.update(suggestion, {
    status: "available",
    stepId: deleteField(),
  });
  await assertSucceeds(deleteBatch.commit());
});

test("denies AI breakdown writes when the parent task does not exist", async () => {
  const userDb = testEnvironment.authenticatedContext("user-1").firestore();
  const latest = doc(userDb, "users/user-1/tasks/missing-task/aiBreakdowns/latest");
  await assertFails(setDoc(latest, aiBreakdown()));
});
