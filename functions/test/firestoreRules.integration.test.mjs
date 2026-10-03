import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')
const testEnvironment = await initializeTestEnvironment({
  projectId: 'demo-todo',
  firestore: { rules },
})

test.after(async () => {
  await testEnvironment.cleanup()
})

test('allows a user to write only their own task', async () => {
  const userDb = testEnvironment.authenticatedContext('user-1').firestore()
  const ownTask = doc(userDb, 'users/user-1/tasks/task-1')
  const otherTask = doc(userDb, 'users/user-2/tasks/task-1')

  await assertSucceeds(setDoc(ownTask, { title: 'Own task' }))
  await assertFails(setDoc(otherTask, { title: 'Other task' }))
})

test('allows a user to read and write only their own settings', async () => {
  const userDb = testEnvironment.authenticatedContext('user-1').firestore()
  const ownSettings = doc(userDb, 'users/user-1/settings/preferences')
  const otherSettings = doc(userDb, 'users/user-2/settings/preferences')

  await assertSucceeds(setDoc(ownSettings, { keys: [], selectedKeyId: 'auto' }))
  await assertFails(setDoc(otherSettings, { keys: [], selectedKeyId: 'auto' }))
})

test('denies unauthenticated task access', async () => {
  const anonymousDb = testEnvironment.unauthenticatedContext().firestore()
  const task = doc(anonymousDb, 'users/user-1/tasks/task-1')

  await assertFails(getDoc(task))
  await assertFails(setDoc(task, { title: 'Blocked task' }))
})

test('denies all client access to reminder jobs', async () => {
  const userDb = testEnvironment.authenticatedContext('user-1').firestore()
  const job = doc(userDb, 'users/user-1/reminderJobs/task-1')

  await assertFails(getDoc(job))
  await assertFails(setDoc(job, { status: 'pending' }))
})

test('allows device registration but prevents ownership changes', async () => {
  const userDb = testEnvironment.authenticatedContext('user-1').firestore()
  const ownDevice = doc(userDb, 'users/user-1/devices/device-1')
  const otherDevice = doc(userDb, 'users/user-2/devices/device-1')

  await assertSucceeds(setDoc(ownDevice, { userId: 'user-1', enabled: true }))
  await assertFails(setDoc(ownDevice, { userId: 'user-2', enabled: true }, { merge: true }))
  await assertFails(setDoc(otherDevice, { userId: 'user-2', enabled: true }))
})
