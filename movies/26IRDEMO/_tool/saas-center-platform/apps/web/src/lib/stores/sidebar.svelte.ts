function createSidebarStore() {
	let drawerOpen = $state(false)

	return {
		get isOpen() {
			return drawerOpen
		},
		open() {
			drawerOpen = true
		},
		close() {
			drawerOpen = false
		},
		toggle() {
			drawerOpen = !drawerOpen
		}
	}
}

export const sidebarDrawer = createSidebarStore()
