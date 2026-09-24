import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WhatsNewModal from '@/components/WhatsNewModal.vue'
import {
  appVersion,
  getUnseenReleaseNotes,
  markReleaseNotesSeen,
  releaseNotes,
} from '@/releaseNotes'

const release = releaseNotes[0]

describe('release notes', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
    })
  })

  it('shows the latest release to a user with no seen version', () => {
    expect(getUnseenReleaseNotes('user-1')).toEqual([release])
  })

  it('does not show the same release again after it is marked as seen', () => {
    markReleaseNotesSeen('user-1', appVersion)

    expect(getUnseenReleaseNotes('user-1')).toEqual([])
  })

  it('shows the latest release when the stored version is unknown', () => {
    markReleaseNotesSeen('user-1', '0.1.0')

    expect(getUnseenReleaseNotes('user-1')).toEqual([release])
  })
})

describe('WhatsNewModal', () => {
  it('renders release details and emits close', async () => {
    const wrapper = mount(WhatsNewModal, {
      props: { releases: [release] },
    })

    expect(wrapper.get('[role="dialog"]').text()).toContain(release.title)
    expect(wrapper.text()).toContain(`v${release.version}`)

    await wrapper.get('button[aria-label="Stäng senaste förändringarna"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
