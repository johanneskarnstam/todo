import assert from "node:assert/strict";
import test from "node:test";
import {
  getReminderJobId,
  getReminderAt,
  isReminderDeliveryEnabled,
  isReminderEligible,
  isReminderTooOld,
} from "../lib/reminderJobs.js";

const baseTask = {
  userId: "user-1",
  taskId: "task-1",
  title: "Test reminder",
  dueDate: "2026-10-01",
  dueTimeZone: "Europe/Stockholm",
  reminder: {offsetMinutes: 10},
};

test("creates a stable idempotency ID", () => {
  assert.equal(
    getReminderJobId("user/1", "task 1", "revision-2"),
    "user%2F1_task%201_revision-2",
  );
});

test("keeps push delivery disabled unless explicitly enabled", () => {
  const previousValue = process.env.PUSH_REMINDERS_ENABLED;
  delete process.env.PUSH_REMINDERS_ENABLED;
  assert.equal(isReminderDeliveryEnabled(), false);
  process.env.PUSH_REMINDERS_ENABLED = "true";
  assert.equal(isReminderDeliveryEnabled(), true);
  if (previousValue === undefined) {
    delete process.env.PUSH_REMINDERS_ENABLED;
  } else {
    process.env.PUSH_REMINDERS_ENABLED = previousValue;
  }
});

test("skips reminders older than fifteen minutes", () => {
  const now = Date.parse("2026-10-01T07:00:00.000Z");
  assert.equal(isReminderTooOld("2026-10-01T06:44:59.000Z", now), true);
  assert.equal(isReminderTooOld("2026-10-01T06:45:00.000Z", now), false);
});

test("accepts an active task with a date, timezone, and reminder", () => {
  assert.equal(isReminderEligible(baseTask), true);
});

test("calculates a Stockholm reminder at local 09:00", () => {
  assert.equal(
    getReminderAt(baseTask),
    "2026-10-01T06:50:00.000Z",
  );
});

test("calculates a timed Stockholm reminder in the stored timezone", () => {
  assert.equal(
    getReminderAt({
      ...baseTask,
      dueDate: "2026-10-01T14:30",
      reminder: {offsetMinutes: 60},
    }),
    "2026-10-01T11:30:00.000Z",
  );
});

test("rejects invalid calendar dates and nonexistent local times", () => {
  assert.equal(
    getReminderAt({...baseTask, dueDate: "2026-02-30"}),
    null,
  );
  assert.equal(
    getReminderAt({
      ...baseTask,
      dueDate: "2026-03-29T02:30",
      reminder: {offsetMinutes: 0},
    }),
    null,
  );
});

test("rejects a date string without a timezone", () => {
  assert.equal(
    isReminderEligible({...baseTask, dueTimeZone: null}),
    false,
  );
});

test("rejects completed tasks", () => {
  assert.equal(isReminderEligible({...baseTask, completed: true}), false);
  assert.equal(
    isReminderEligible({...baseTask, status: "completed"}),
    false,
  );
});

test("rejects an invalid timezone", () => {
  assert.equal(
    isReminderEligible({...baseTask, dueTimeZone: "Not/A-Timezone"}),
    false,
  );
});

test("accepts an active task with absolute reminder without due date", () => {
  const task = {
    userId: "user-1",
    taskId: "task-abs",
    title: "Absolute reminder",
    reminders: [
      {
        mode: "absolute",
        at: "2026-10-15T09:00",
        timeZone: "Europe/Stockholm",
      },
    ],
  };
  assert.equal(isReminderEligible(task), true);
  assert.equal(getReminderAt(task), "2026-10-15T07:00:00.000Z");
});

test("rejects relative reminder when due date is missing", () => {
  const task = {
    userId: "user-1",
    taskId: "task-rel",
    title: "Relative reminder without due date",
    reminders: [{mode: "relative", offsetMinutes: 10}],
  };
  assert.equal(isReminderEligible(task), false);
  assert.equal(getReminderAt(task), null);
});

test("supports multiple reminders by index", () => {
  const task = {
    userId: "user-1",
    taskId: "task-multi",
    title: "Multi reminder",
    dueDate: "2026-10-01",
    dueTimeZone: "Europe/Stockholm",
    reminders: [
      {mode: "relative", offsetMinutes: 60},
      {mode: "absolute", at: "2026-09-30T12:00", timeZone: "Europe/Stockholm"},
    ],
  };
  assert.equal(isReminderEligible(task, 0), true);
  assert.equal(getReminderAt(task, 0), "2026-10-01T06:00:00.000Z");
  assert.equal(isReminderEligible(task, 1), true);
  assert.equal(getReminderAt(task, 1), "2026-09-30T10:00:00.000Z");
  assert.equal(isReminderEligible(task, 2), false);
  assert.equal(getReminderAt(task, 2), null);
});

test("creates distinct idempotency ID when reminderIndex > 0", () => {
  assert.equal(
    getReminderJobId("user/1", "task 1", "revision-2", 1),
    "user%2F1_task%201_1_revision-2",
  );
});

