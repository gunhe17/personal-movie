<script lang="ts" module>
  /**
   * 비밀번호 정책 — 백엔드 `app/core/password_policy.py`와 같은 규칙이어야 한다.
   *
   * signup·reset-password·accept-invite 세 화면이 이 정규식들을 각자
   * 리터럴로 갖고 있었다. 정책이 바뀌면 세 곳을 다 고쳐야 했고, 한 곳만
   * 놓치면 화면은 통과시키는데 서버가 거절하는 상태가 된다.
   */
  export const PASSWORD_RULES = [
    { label: '8자 이상', test: (v: string) => v.length >= 8 },
    { label: '소문자 포함', test: (v: string) => /[a-z]/.test(v) },
    { label: '대문자 포함', test: (v: string) => /[A-Z]/.test(v) },
    { label: '숫자 포함', test: (v: string) => /\d/.test(v) },
    { label: '특수문자 포함', test: (v: string) => /[^A-Za-z0-9]/.test(v) }
  ] as const

  /** 모든 규칙을 만족하는가 — 폼 유효성 판정에 쓴다. */
  export function passwordMeetsPolicy(value: string): boolean {
    return PASSWORD_RULES.every((r) => r.test(value))
  }
</script>

<script lang="ts">
  /**
   * PasswordPolicyList — 입력한 비밀번호가 각 규칙을 만족하는지 표시.
   *
   * 값이 비어 있으면 아무것도 그리지 않는다(입력 전부터 빨간 목록이
   * 뜨면 실패를 지적하는 것처럼 읽힌다).
   */
  interface Props {
    value: string
    /**
     * 정책 밖의 추가 조건 (예: 비밀번호 변경의 '현재와 다름').
     * 만족하지 않으면 회색이 아니라 빨강으로 표시한다 — 아직 입력 안 한
     * 규칙과 달리, 이미 위반한 상태라서다.
     */
    extra?: { label: string; ok: boolean }[]
    class?: string
  }

  let { value, extra = [], class: className = '' }: Props = $props()
</script>

{#if value.length > 0}
  <ul class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-body-03-regular {className}">
    {#each PASSWORD_RULES as rule (rule.label)}
      {@const ok = rule.test(value)}
      <li class={ok ? 'text-green-700' : 'text-gray-400'}>
        <span aria-hidden="true">{ok ? '✓' : '·'}</span>
        {rule.label}
      </li>
    {/each}
    {#each extra as item (item.label)}
      <li class={item.ok ? 'text-green-700' : 'text-red-500'}>
        <span aria-hidden="true">{item.ok ? '✓' : '!'}</span>
        {item.label}
      </li>
    {/each}
  </ul>
{/if}
