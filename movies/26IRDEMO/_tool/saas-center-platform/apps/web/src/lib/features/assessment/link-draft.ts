export interface LinkDraft {
  definition: string
  responses: Record<number, number>
  page: number
}

export function linkDraftKey(linkId: string, taskId: string) {
  return `assessment-link:draft:v1:${encodeURIComponent(linkId)}:${encodeURIComponent(taskId)}`
}

export function readLinkDraft(
  storage: Storage,
  key: string,
  definition: string
): LinkDraft | null {
  const raw = storage.getItem(key)
  if (!raw) return null
  let draft: LinkDraft
  try {
    draft = JSON.parse(raw)
  } catch {
    storage.removeItem(key)
    return null
  }
  if (
    !draft ||
    draft.definition !== definition ||
    !Number.isInteger(draft.page) ||
    draft.page < 1 ||
    !draft.responses ||
    Array.isArray(draft.responses) ||
    typeof draft.responses !== 'object' ||
    Object.entries(draft.responses).some(
      ([number, answer]) =>
        !/^\d+$/.test(number) ||
        typeof answer !== 'number' ||
        !Number.isFinite(answer)
    )
  ) {
    storage.removeItem(key)
    return null
  }
  return draft
}

export function saveLinkDraft(storage: Storage, key: string, draft: LinkDraft) {
  storage.setItem(key, JSON.stringify(draft))
}
