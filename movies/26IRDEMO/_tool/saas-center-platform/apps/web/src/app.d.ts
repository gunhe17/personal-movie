// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

export interface UserInfo {
	id: string;
	email: string;
	name: string;
	phone?: string;
	role: string;
	centers?: Array<{
		id: string;
		name: string;
		[key: string]: unknown;
	}>;
}

declare global {
	// 빌드 시 Vite define으로 주입되는 상수
	const __APP_VERSION__: string;
	const __BUILD_TIME__: string;
	const __BUILD_ENV__: string;
	const __GIT_SHA__: string;

	namespace App {
		// interface Error {}
		interface Locals {
			user: UserInfo | null;
			accessToken: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
