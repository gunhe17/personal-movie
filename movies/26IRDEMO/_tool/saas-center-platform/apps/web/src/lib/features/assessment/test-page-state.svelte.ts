export const testPage = $state({
  url: new URL('http://localhost/verify-link?send_link_id=test-link'),
  state: {} as Record<string, unknown>
})
