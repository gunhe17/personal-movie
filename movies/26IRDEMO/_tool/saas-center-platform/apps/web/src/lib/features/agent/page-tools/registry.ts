/**
 * Page Tool Registry — 페이지별 도구 등록/해제/실행 관리.
 *
 * 각 페이지가 onMount에서 자기 도구를 등록하고, onDestroy에서 해제한다.
 * SSE page_tool_call 이벤트 수신 시 executor가 이 registry를 통해 실행한다.
 */

export interface PageToolResult {
  result: string
  is_error: boolean
}

type PageToolHandler = (args: Record<string, unknown>) => Promise<PageToolResult> | PageToolResult

class PageToolRegistry {
  private _handlers = new Map<string, PageToolHandler>()
  private _mountResolve: (() => void) | null = null

  register(name: string, handler: PageToolHandler): void {
    this._handlers.set(name, handler)
  }

  unregister(name: string): void {
    this._handlers.delete(name)
  }

  unregisterAll(): void {
    this._handlers.clear()
  }

  has(name: string): boolean {
    return this._handlers.has(name)
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    options: { waitMs?: number; intervalMs?: number } = {},
  ): Promise<PageToolResult> {
    // navigate 직후 새 페이지가 마운트되며 핸들러를 등록하는 사이의 race를 흡수.
    // 핸들러가 등록될 때까지 짧게 폴링하고, 시간 초과 시 에러 반환.
    const waitMs = options.waitMs ?? 2000
    const intervalMs = options.intervalMs ?? 50
    const start = Date.now()

    while (!this._handlers.has(name)) {
      if (Date.now() - start > waitMs) {
        return { result: `Tool not available on current page: ${name}`, is_error: true }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
    }

    const handler = this._handlers.get(name)!
    try {
      return await handler(args)
    } catch (e) {
      return { result: `Execution error: ${(e as Error).message}`, is_error: true }
    }
  }

  /**
   * navigate 후 새 페이지가 마운트되어 도구를 등록할 때까지 대기한다.
   * 타임아웃 시 자동 resolve (이후 page tool 호출이 "not available" 에러를 반환).
   */
  waitForPageMount(timeoutMs = 5000): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this._mountResolve = null
        resolve()
      }, timeoutMs)

      this._mountResolve = () => {
        clearTimeout(timer)
        resolve()
      }
    })
  }

  /**
   * 페이지 onMount에서 도구 등록 완료 후 호출.
   * waitForPageMount의 Promise를 resolve한다.
   */
  notifyPageMounted(): void {
    if (this._mountResolve) {
      this._mountResolve()
      this._mountResolve = null
    }
  }
}

export const pageToolRegistry = new PageToolRegistry()
