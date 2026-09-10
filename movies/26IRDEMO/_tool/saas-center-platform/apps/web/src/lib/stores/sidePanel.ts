import { writable } from 'svelte/store'
import type { ComponentType } from 'svelte'
import { generateId } from '../utils/generator'

export interface PanelConfig<T = any, R = any> {
  id: string
  component: ComponentType
  props: T
  options?: PanelOptions
  resolve?: (value: R | PromiseLike<R>) => void
  reject?: (reason?: any) => void
}

// width: 사이드 패널의 넓이, isZAbove
export interface PanelOptions {
  width?: string
  isZAboveAll?: boolean
  fullScreenOnMobile?: boolean
  /** true면 배경 클릭·ESC로 닫히지 않고 X(닫기) 버튼으로만 닫힌다. (예: 필드노트를 보며 작성) */
  disableBackdropClose?: boolean
}

export type PanelState = {
  panel: PanelConfig | undefined
}

const createPanelStore = () => {
  const { subscribe, update } = writable<PanelState>(undefined)

  const open = <T = any>(config: {
    component: ComponentType
    props: T
    options?: PanelOptions
  }) => {
    const id = generateId(false)
    const panelConfig: PanelConfig<T> = {
      id,
      component: config.component,
      props: {
        ...config.props,
        panelId: id,
        closePanel: () => close()
      } as T,
      options: config.options
    }

    update(() => ({
      panel: panelConfig
    }))

    return id
  }

  const close = () => {
    update(() => {
      return {
        panel: undefined
      }
    })
  }

  return {
    subscribe,
    open,
    close
  }
}

export const panelStore = createPanelStore()
