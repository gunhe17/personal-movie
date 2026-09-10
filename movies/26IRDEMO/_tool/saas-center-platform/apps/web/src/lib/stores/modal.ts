import { writable } from 'svelte/store'
import type { Component } from 'svelte'
import { generateId } from '../utils/generator'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = Component<any, any, any>

// 제네릭 모달 설정
export interface ModalConfig<T = any, R = any> {
  id: string
  component: AnyComponent
  props: T
  options?: ModalOptions
  resolve?: (value: R | PromiseLike<R>) => void
  reject?: (reason?: any) => void
}

export interface ModalOptions {
  size?:
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | 'wide'
    | 'wideXl'
    | 'custom500'
    | 'tall'
    | 'narrow'
    | 'fit'
    | 'full'
  desktopOnly?: boolean // 모바일에서 모달 차단 (스낵바 안내)
  customWidth?: number // 픽셀 단위로 직접 너비 지정
  customHeight?: number // 픽셀 단위로 직접 높이 지정
  placement?: 'center' | 'bottom' // 기본 center. bottom = 화면 하단 고정 시트
  closeOnBackdropClick?: boolean
  isReceipt?: boolean
  closeOnEscape?: boolean
  persistent?: boolean // 모달 닫기 방지
  className?: string // 커스텀 스타일링
  onClose?: () => void // 모달 닫힐 때 콜백
  overflowVisible?: boolean // 모달 내부 overflow-hidden 해제 (페이지 스택 등 외곽 peek 용)
}

// 향상된 모달 결과 타입
export type ModalResult<T = any> = {
  success: boolean
  data?: T
  error?: string
  cancelled?: boolean
}

// 모달 액션 타입들
export type ModalAction<T = any, R = any> = {
  type: 'submit' | 'cancel' | 'custom'
  handler: (data?: T) => Promise<ModalResult<R>> | ModalResult<R>
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
}

interface ModalState {
  modals: ModalConfig[]
  isOpen: boolean
}

const initialState: ModalState = {
  modals: [],
  isOpen: false
}

function createModalStore() {
  const { subscribe, update } = writable<ModalState>(initialState)

  // Promise 기반 모달 열기
  const openWithPromise = <T = any, R = any>(
    component: AnyComponent,
    props: T,
    options?: ModalOptions
  ): Promise<R> => {
    if (isDesktopOnlyBlocked(options)) {
      showDesktopOnlyMessage()
      return Promise.resolve(null as unknown as R)
    }
    return new Promise((resolve, reject) => {
      const id = generateId()
      const modalConfig: ModalConfig<T, R> = {
        id,
        component,
        props: {
          ...props,
          modalId: id,
          closeModal: () => close(id),
          _modalResolve: resolve,
          _modalReject: reject
        } as T,
        options,
        resolve,
        reject
      }

      update((state) => ({
        modals: [...state.modals, modalConfig],
        isOpen: true
      }))
    })
  }

  // desktopOnly 가드: 모바일에서만 차단 (태블릿 768px+ 허용)
  const isDesktopOnlyBlocked = (options?: ModalOptions): boolean => {
    if (!options?.desktopOnly) return false
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  }

  const showDesktopOnlyMessage = () => {
    import('../stores/snackbar').then(({ snackbarStore }) => {
      snackbarStore.info('이 기능은 데스크탑이나 태블릿에서 이용해주세요')
    })
  }

  // 기존 방식 (하위 호환성)
  const open = <T = any>(config: {
    component: AnyComponent
    props: T
    options?: ModalOptions
  }) => {
    if (isDesktopOnlyBlocked(config.options)) {
      showDesktopOnlyMessage()
      return ''
    }
    const id = generateId()
    const modalConfig: ModalConfig<T> = {
      id,
      component: config.component,
      props: {
        ...config.props,
        modalId: id,
        closeModal: () => close(id)
      } as T,
      options: config.options
    }

    update((state) => ({
      modals: [...state.modals, modalConfig],
      isOpen: true
    }))

    return id
  }

  const close = (id?: string) => {
    let onCloseCallback: (() => void) | undefined

    update((state) => {
      let newModals: ModalConfig[]

      if (id) {
        // 특정 모달 닫기
        const modalIndex = state.modals.findIndex((modal) => modal.id === id)
        if (modalIndex === -1) return state

        const modal = state.modals[modalIndex]
        // Promise 기반 모달이면 취소로 처리 (에러가 아님)
        if (modal.resolve) {
          modal.resolve(null)
        }
        onCloseCallback = modal.options?.onClose

        newModals = state.modals.filter((modal) => modal.id !== id)
      } else {
        // 최상위 모달 닫기
        if (state.modals.length === 0) return state

        const topModal = state.modals[state.modals.length - 1]
        if (topModal.resolve) {
          topModal.resolve(null)
        }
        onCloseCallback = topModal.options?.onClose

        newModals = state.modals.slice(0, -1)
      }

      return {
        modals: newModals,
        isOpen: newModals.length > 0
      }
    })

    // 상태 업데이트 후 onClose 콜백 실행
    if (onCloseCallback) {
      onCloseCallback()
    }
  }

  const closeAll = () => {
    update((state) => {
      // 모든 Promise 기반 모달들을 취소로 처리
      state.modals.forEach((modal) => {
        if (modal.resolve) {
          modal.resolve(null)
        }
      })

      return initialState
    })
  }

  const getTopModal = (): ModalConfig | null => {
    let topModal: ModalConfig | null = null
    update((state) => {
      topModal =
        state.modals.length > 0 ? state.modals[state.modals.length - 1] : null
      return state
    })
    return topModal
  }

  // 모달 결과와 함께 닫기
  const resolve = <T = any>(id: string, result: T) => {
    update((state) => {
      const modal = state.modals.find((m) => m.id === id)
      if (modal && modal.resolve) {
        modal.resolve(result)
      }

      const newModals = state.modals.filter((m) => m.id !== id)
      return {
        modals: newModals,
        isOpen: newModals.length > 0
      }
    })
  }

  const updateModalOptions = (
    id: string,
    newOptions: Partial<ModalOptions>
  ) => {
    update((state) => ({
      ...state,
      modals: state.modals.map((modal) =>
        modal.id === id
          ? { ...modal, options: { ...modal.options, ...newOptions } }
          : modal
      )
    }))
  }

  return {
    subscribe,
    open,
    openWithPromise,
    close,
    closeAll,
    getTopModal,
    resolve,
    updateModalOptions
  }
}

export const modalStore = createModalStore()

// 유틸리티 함수들
export const modalUtils = {
  // 확인 모달
  confirm: async (
    message: string,
    title = '확인',
    options?: {
      description?: string
      confirmText?: string
      cancelText?: string
      type?: 'info' | 'warning' | 'danger'
      /** 타입 기본 아이콘 대신 쓸 아이콘 */
      icon?: any
    }
  ): Promise<boolean> => {
    try {
      const { default: ConfirmModal } = await import(
        '../components/modal/ConfirmModal.svelte'
      )
      const result = await modalStore.openWithPromise(
        ConfirmModal,
        {
          title,
          message,
          description: options?.description,
          confirmText: options?.confirmText,
          cancelText: options?.cancelText,
          // 기본은 중립 — '!' 경고 아이콘은 위험(파괴적·비가역) 액션에만 명시적으로 붙인다
          type: options?.type ?? 'info',
          icon: options?.icon
        },
        { customWidth: 420 }
      )
      return result === 'confirmed'
    } catch {
      return false
    }
  },

  // 알림 모달
  alert: async (message: string, title = '알림'): Promise<void> => {
    try {
      const { default: ConfirmModal } = await import(
        '../components/modal/ConfirmModal.svelte'
      )
      await modalStore.openWithPromise(
        ConfirmModal,
        {
          title,
          message,
          type: 'info',
          confirmText: '확인'
        },
        { customWidth: 420 }
      )
    } catch {
      // 무시
    }
  },

  // 프롬프트 모달 (텍스트 입력)
  prompt: async (
    message: string,
    title = '입력',
    options?: {
      placeholder?: string
      maxLength?: number
      confirmText?: string
    }
  ): Promise<string | null> => {
    const { default: ReasonInputModal } = await import(
      '../components/modal/ReasonInputModal.svelte'
    )
    // 폭 420 = 소형 다이얼로그(popup) 규격 — 위 confirm/alert, 노쇼 사유 모달과 동일.
    // 지정하지 않으면 기본 사이즈(md=640)로 열려 한 줄 입력에 비해 과하게 넓다.
    return modalStore.openWithPromise(
      ReasonInputModal,
      {
        title,
        message,
        ...options
      },
      { customWidth: 420 }
    ) as Promise<string | null>
  },

  // 폼 모달 (제네릭)
  openForm: async <T = any, R = any>(
    FormComponent: AnyComponent,
    initialData: T,
    options?: ModalOptions
  ): Promise<R> => {
    return modalStore.openWithPromise(FormComponent, { initialData }, options)
  }
}
