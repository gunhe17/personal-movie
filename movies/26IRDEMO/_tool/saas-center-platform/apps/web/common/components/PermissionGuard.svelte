<script lang="ts">
  import type {
    Permission,
    UserRole,
    PermissionRule
  } from '$lib/types/permissions'
  import { permissionEngine } from '$lib/utils/permission-engine'
  import { auth } from '$lib/stores/auth'
  import { permissionStore } from '$lib/stores/permission.store'

  interface Props {
    children?: import('svelte').Snippet

    // 새로운 방식 - 권한 규칙 객체 (권장)
    rule?: PermissionRule

    // 레거시 방식 - 하위 호환성 (단순한 케이스용)
    permission?: Permission
    anyPermission?: Permission[]
    allPermissions?: Permission[]
    role?: UserRole
    anyRole?: UserRole[]

    // 권한이 없을 때 표시할 내용
    fallback?: import('svelte').Snippet

    // 에러 메시지 표시 여부
    showError?: boolean

    // 디버그 모드
    debug?: boolean

    // 로딩 중 표시할 내용
    loading?: import('svelte').Snippet
  }

  let {
    children,
    rule,
    permission,
    anyPermission,
    allPermissions,
    role,
    anyRole,
    fallback,
    showError = false,
    debug = false,
    loading
  }: Props = $props()

  // 레거시 props를 새로운 rule 형식으로 변환
  const convertedRule = $derived.by(() => {
    if (rule) return rule

    const legacyRule: PermissionRule = {}

    if (permission) legacyRule.any = [permission]
    if (anyPermission) legacyRule.any = anyPermission
    if (allPermissions) legacyRule.all = allPermissions
    if (role) legacyRule.roles = [role]
    if (anyRole) legacyRule.roles = anyRole

    return legacyRule
  })

  // 권한 컨텍스트 - permissionStore 기반 (단일 소스)
  const context = $derived.by(() => {
    // permissionStore에서 동기화된 최신 권한 사용
    if ($permissionStore.context) {
      return $permissionStore.context
    }
    // fallback: 초기화 전에는 기본값
    return {
      permissions: [] as Permission[],
      role: null as UserRole | null,
      accessLevel: 'all' as const,
      isAuthenticated: $auth.isAuthenticated,
      version: 0,
      updatedAt: ''
    }
  })

  // 권한 평가
  const evaluationResult = $derived.by(() => {
    if ($auth.isLoading) {
      return {
        granted: null,
        reason: 'Loading...',
        missingPermissions: undefined
      }
    }

    const result = permissionEngine.evaluate(convertedRule, context)

    if (debug) {
      console.log('PermissionGuard Evaluation:', {
        rule: convertedRule,
        context,
        result
      })
    }

    return result
  })

  // 최종 접근 권한 결정
  const canAccess = $derived(evaluationResult.granted === true)
  const isLoading = $derived(
    $auth.isLoading ||
      $permissionStore.isLoading ||
      evaluationResult.granted === null
  )
  const errorMessage = $derived(evaluationResult.reason)
</script>

{#if isLoading && loading}
  {@render loading()}
{:else if canAccess && children}
  {@render children()}
{:else if fallback}
  {@render fallback()}
{:else if showError}
  <div class="flex h-full w-full items-center justify-center">
    <div class="flex flex-col items-center gap-3 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <p class="text-base font-semibold text-gray-700">접근 권한이 없습니다</p>
      <p class="text-sm text-gray-400">이 페이지를 보려면 관리자에게 문의하세요.</p>
    </div>
  </div>
{/if}
