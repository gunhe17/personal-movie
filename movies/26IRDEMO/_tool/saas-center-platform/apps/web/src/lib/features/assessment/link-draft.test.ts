import { describe, it, expect } from 'vitest'
import { linkDraftKey, readLinkDraft, saveLinkDraft } from './link-draft'

function storage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
    key: (index) => [...data.keys()][index] ?? null
  }
}

describe('link-scoped response drafts', () => {
  it('restores responses and deletes only the completed task', () => {
    const browserStorage = storage()
    const first = linkDraftKey('link', 'first')
    const second = linkDraftKey('link', 'second')
    const draft = { definition: 'version', responses: { 1: 2 }, page: 2 }
    saveLinkDraft(browserStorage, first, draft)
    saveLinkDraft(browserStorage, second, draft)
    expect(readLinkDraft(browserStorage, first, 'version')).toEqual(draft)
    expect(
      readLinkDraft(
        browserStorage,
        linkDraftKey('another-link', 'first'),
        'version'
      )
    ).toBeNull()
    browserStorage.removeItem(first)
    expect(readLinkDraft(browserStorage, first, 'version')).toBeNull()
    expect(readLinkDraft(browserStorage, second, 'version')).toEqual(draft)
  })
  it('discards invalid drafts and changed questionnaires', () => {
    const browserStorage = storage()
    for (const raw of [
      'null',
      '{broken',
      JSON.stringify({ definition: 'old', responses: {}, page: 1 }),
      JSON.stringify({
        definition: 'current',
        responses: { 1: 'invalid' },
        page: 1
      })
    ]) {
      browserStorage.setItem('draft', raw)
      expect(readLinkDraft(browserStorage, 'draft', 'current')).toBeNull()
      expect(browserStorage.getItem('draft')).toBeNull()
    }
  })
  it('surfaces storage failures instead of reporting a saved draft', () => {
    const browserStorage = storage()
    browserStorage.setItem = () => {
      throw new Error('Quota exceeded')
    }
    expect(() =>
      saveLinkDraft(browserStorage, 'draft', {
        definition: '',
        responses: {},
        page: 1
      })
    ).toThrow('Quota exceeded')
  })
})
