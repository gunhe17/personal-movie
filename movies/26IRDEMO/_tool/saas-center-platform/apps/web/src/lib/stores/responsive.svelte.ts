import { browser } from '$app/environment'

// 브레이크포인트 정의
export const BREAKPOINTS = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536
} as const

export type BreakpointKey = keyof typeof BREAKPOINTS
export type DeviceType = 'mobile' | 'tablet' | 'desktop'

interface ResponsiveState {
	width: number
	height: number
	device: DeviceType
	isMobile: boolean
	isTablet: boolean
	isDesktop: boolean
	breakpoint: BreakpointKey
}

function calcState(): ResponsiveState {
	if (!browser) {
		return {
			width: 1280,
			height: 720,
			device: 'desktop',
			isMobile: false,
			isTablet: false,
			isDesktop: true,
			breakpoint: 'xl'
		}
	}

	const width = window.innerWidth
	const height = window.innerHeight

	let device: DeviceType = 'desktop'
	let breakpoint: BreakpointKey = '2xl'

	if (width < BREAKPOINTS.md) {
		device = 'mobile'
		breakpoint = 'sm'
	} else if (width < BREAKPOINTS.xl) {
		device = 'tablet'
		breakpoint = width < BREAKPOINTS.lg ? 'md' : 'lg'
	} else {
		device = 'desktop'
		breakpoint = width < BREAKPOINTS['2xl'] ? 'xl' : '2xl'
	}

	return {
		width,
		height,
		device,
		isMobile: device === 'mobile',
		isTablet: device === 'tablet',
		isDesktop: device === 'desktop',
		breakpoint
	}
}

function createResponsiveState() {
	let state = $state<ResponsiveState>(calcState())

	if (browser) {
		window.addEventListener('resize', () => {
			state = calcState()
		})
	}

	return {
		get width() {
			return state.width
		},
		get height() {
			return state.height
		},
		get device() {
			return state.device
		},
		get isMobile() {
			return state.isMobile
		},
		get isTablet() {
			return state.isTablet
		},
		get isDesktop() {
			return state.isDesktop
		},
		get breakpoint() {
			return state.breakpoint
		}
	}
}

export const responsive = createResponsiveState()
