// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
      user: UserInfo | null
    }
  }
}

export interface UserInfo {
  id: string
  email: string
  name: string
  role: 'admin' | 'clinician' | 'researcher'
}

export {}
