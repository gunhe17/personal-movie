import type { AxiosInstance } from 'axios'
import { goto } from '$app/navigation'
import { auth } from '$lib/stores/auth'
import { snackbarStore } from '$lib/stores/snackbar'
import { browser } from '$app/environment'

const setInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (browser) {
        if (error.response?.status === 401) {
          await auth.logout()
          goto('/login')
        } else if (error.response?.status === 403) {
          snackbarStore.error('접근 권한이 없습니다.')
        }
      }
      return Promise.reject(error)
    }
  )
}

export default setInterceptors
