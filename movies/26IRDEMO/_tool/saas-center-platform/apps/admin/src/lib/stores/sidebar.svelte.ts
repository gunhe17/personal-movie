import { browser } from '$app/environment'

const STORAGE_KEY = 'admin-sidebar-collapsed'

let collapsed = $state(
  browser ? localStorage.getItem(STORAGE_KEY) === 'true' : false
)

export const sidebar = {
  get collapsed() {
    return collapsed
  },

  toggle() {
    collapsed = !collapsed
    if (browser) {
      localStorage.setItem(STORAGE_KEY, String(collapsed))
      document.documentElement.style.setProperty(
        '--sidebar-width',
        collapsed ? '72px' : '240px'
      )
      document.documentElement.dataset.sidebarCollapsed = String(collapsed)
    }
  },

  expand() {
    collapsed = false
    if (browser) {
      localStorage.setItem(STORAGE_KEY, 'false')
      document.documentElement.style.setProperty(
        '--sidebar-width',
        '240px'
      )
      document.documentElement.dataset.sidebarCollapsed = 'false'
    }
  }
}
