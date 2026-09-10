import { writable } from 'svelte/store'

export interface SnackbarData {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning' | 'request'
  size?: 'sm' | 'md' | 'lg'
  duration?: number
  isVisible?: boolean
  link?: {
    text: string
    href: string
  } | null
  /**
   * 그 자리에서 실행하는 액션(되돌리기 등). link와 배타 — 스낵바 폭(360)에 꼬리 버튼은 하나다.
   */
  action?: {
    text: string
    run: () => void | Promise<void>
  } | null
}

type SnackbarOptions = {
  size?: SnackbarData['size']
}

function createSnackbarStore() {
  const { subscribe, set, update } = writable<SnackbarData[]>([])

  let nextId = 1

  const resolveDurationAndOptions = (
    durationOrOptions: number | SnackbarOptions | undefined,
    options: SnackbarOptions | undefined,
    defaultDuration: number
  ) => {
    if (typeof durationOrOptions === 'number') {
      return { duration: durationOrOptions, options }
    }
    if (durationOrOptions && typeof durationOrOptions === 'object') {
      return { duration: defaultDuration, options: durationOrOptions }
    }
    return { duration: defaultDuration, options }
  }

  /** 대기열에 넣고 duration 뒤 자동으로 걷는다 — show/undoable 공용 */
  const enqueue = (snackbar: SnackbarData) => {
    const { id, duration = 2000 } = snackbar
    update((snackbars) => [...snackbars, snackbar])

    // 자동으로 제거
    setTimeout(() => {
      update((snackbars) =>
        snackbars.map((s) => (s.id === id ? { ...s, isVisible: false } : s))
      )

      // 애니메이션 완료 후 배열에서 제거
      setTimeout(() => {
        update((snackbars) => snackbars.filter((s) => s.id !== id))
      }, 500) // 애니메이션 시간
    }, duration)

    return id
  }

  const store = {
    subscribe,
    show: (
      message: string,
      link?: {
        text: string
        href: string
      } | null,
      type: SnackbarData['type'] = 'success',
      duration = 2000,
      options?: SnackbarOptions
    ) =>
      enqueue({
        id: `snackbar-${nextId++}`,
        message,
        link,
        type,
        size: options?.size,
        duration,
        isVisible: true
      }),

    /**
     * 되돌릴 수 있는 처리 결과 — 메시지 + 되돌리기 버튼.
     * 확인 팝업으로 한 번 물었더라도 오조작은 남으므로, 실행 직후 되돌릴 창을 준다.
     * 기본 노출은 6초 — 2초(show 기본)는 문장을 읽고 버튼을 누르기엔 짧다.
     */
    undoable: (
      message: string,
      onUndo: () => void | Promise<void>,
      undoText = '되돌리기',
      duration = 6000
    ) =>
      enqueue({
        id: `snackbar-${nextId++}`,
        message,
        action: { text: undoText, run: onUndo },
        type: 'success',
        duration,
        isVisible: true
      }),
    // 편의 함수들
    success: (
      message: string,
      durationOrOptions: number | SnackbarOptions = 2000,
      options?: SnackbarOptions
    ) => {
      const resolved = resolveDurationAndOptions(
        durationOrOptions,
        options,
        2000
      )
      return store.show(
        message,
        null,
        'success',
        resolved.duration,
        resolved.options
      )
    },
    error: (
      message: string,
      link: { text: string; href: string } | null = null,
      durationOrOptions: number | SnackbarOptions = 3000,
      options?: SnackbarOptions
    ) => {
      const resolved = resolveDurationAndOptions(
        durationOrOptions,
        options,
        3000
      )
      return store.show(
        message,
        link,
        'error',
        resolved.duration,
        resolved.options
      )
    },
    warning: (
      message: string,
      link: { text: string; href: string } | null = null,
      durationOrOptions: number | SnackbarOptions = 2500,
      options?: SnackbarOptions
    ) => {
      const resolved = resolveDurationAndOptions(
        durationOrOptions,
        options,
        2500
      )
      return store.show(
        message,
        link,
        'warning',
        resolved.duration,
        resolved.options
      )
    },
    info: (
      message: string,
      durationOrOptions: number | SnackbarOptions = 2000,
      options?: SnackbarOptions
    ) => {
      const resolved = resolveDurationAndOptions(
        durationOrOptions,
        options,
        2000
      )
      return store.show(
        message,
        null,
        'info',
        resolved.duration,
        resolved.options
      )
    },
    request: (
      message: string,
      durationOrOptions: number | SnackbarOptions = 2000,
      options?: SnackbarOptions
    ) => {
      const resolved = resolveDurationAndOptions(
        durationOrOptions,
        options,
        2000
      )
      return store.show(
        message,
        null,
        'request',
        resolved.duration,
        resolved.options
      )
    },
    hide: (id: string) => {
      update((snackbars) =>
        snackbars.map((s) => (s.id === id ? { ...s, isVisible: false } : s))
      )

      setTimeout(() => {
        update((snackbars) => snackbars.filter((s) => s.id !== id))
      }, 500)
    },
    clear: () => set([])
  }

  return store
}

export const snackbarStore = createSnackbarStore()
