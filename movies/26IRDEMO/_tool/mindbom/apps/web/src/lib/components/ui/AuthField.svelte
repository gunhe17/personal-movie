<script lang="ts">
  /**
   * AuthField — 인증 화면의 레이블+입력+에러 한 벌.
   *
   * 5개 화면이 같은 input 클래스 문자열(높이 48·rounded-xl·에러 시 빨간
   * 보더 분기)을 복붙하고 있었다. 에러 분기가 각 화면에 흩어져 있어
   * 어떤 화면은 에러 문구가 없고 어떤 화면은 색만 바뀌는 식으로 갈렸다.
   *
   * ⚠️ `bind:value`와 동적 `type=`은 함께 못 쓴다(Svelte 컴파일 에러).
   *    그래서 값은 `value` + `oninput`으로 직접 제어하고, 바깥에는
   *    `$bindable`로 노출해 호출부는 그대로 `bind:value`를 쓴다.
   */
  import type { HTMLInputAttributes } from 'svelte/elements'

  interface Props {
    id: string
    label: string
    value: string
    type?: 'text' | 'email' | 'password' | 'tel'
    placeholder?: string
    /** DOM의 FullAutoFill 유니온을 그대로 받는다 ('email' · 'new-password' …) */
    autocomplete?: HTMLInputAttributes['autocomplete']
    required?: boolean
    disabled?: boolean
    /** 문구를 주면 필드가 에러 상태가 되고 아래에 표시된다 */
    error?: string
    /**
     * 문구 없이 에러 표시만. 어느 필드가 틀렸는지 특정할 수 없어
     * 여러 필드를 함께 빨갛게 하고 사유는 폼 단위로 한 번만 보여줄 때 쓴다
     * (예: 로그인 실패 — 이메일·비밀번호 중 무엇이 틀렸는지 알려주지 않는다).
     */
    invalid?: boolean
    /** 에러가 아닌 안내 문구 (비밀번호 규칙 등) */
    hint?: string
    onkeypress?: (e: KeyboardEvent) => void
  }

  let {
    id,
    label,
    value = $bindable(),
    type = 'text',
    placeholder,
    autocomplete,
    required = false,
    disabled = false,
    error,
    invalid = false,
    hint,
    onkeypress
  }: Props = $props()

  let hasError = $derived(Boolean(error) || invalid)
</script>

<div>
  <label for={id} class="mb-2 block text-body-02-medium text-gray-700">
    {label}
  </label>

  <input
    {id}
    name={id}
    {type}
    {autocomplete}
    {required}
    {disabled}
    {placeholder}
    {onkeypress}
    {value}
    oninput={(e) => (value = e.currentTarget.value)}
    aria-invalid={hasError || undefined}
    class="h-12 w-full rounded-lg border bg-white px-4 text-body-01-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400
      {hasError
      ? 'border-red-500 focus:border-red-500'
      : 'border-gray-200 focus:border-primary-400'}"
  />

  {#if error}
    <p class="mt-1.5 text-body-03-regular text-red-500">{error}</p>
  {:else if hint}
    <p class="mt-1.5 text-body-03-regular text-gray-400">{hint}</p>
  {/if}
</div>
