<script lang="ts">
  /**
   * 내담자 요약 표기 — `생년월일 | 성별` 단일 규격.
   *
   * 목록·카드·테이블 어디서든 이 컴포넌트를 쓴다. 화면마다 손으로 조합하면
   * 구분자와 성별 문구가 갈라진다 — 실제로 검사 목록은 두 칸으로 나눠 적고
   * 검사 헤더는 '만 N세'까지 붙이는 식으로 이미 달랐다.
   *
   * 나이는 싣지 않는다 — 목록에서 필요한 정보가 아니고, 생년월일이 있으면
   * 상세에서 계산한다.
   *
   * 시크릿 모드 마스킹을 안에서 처리한다. 호출부가 각자 처리하면 한 곳만
   * 빠뜨려도 그 화면에서 개인정보가 노출된다.
   */
  import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
  import { GENDER_LABELS } from '../constants'

  interface Props {
    /** 'YYYY-MM-DD' 등 Date로 파싱 가능한 문자열 */
    birthDate?: string | null
    gender?: string | null
    /** 글자 크기·색 — 쓰는 자리에 맞춘다 */
    class?: string
  }

  let { birthDate = null, gender = null, class: className = '' }: Props =
    $props()

  let birthLabel = $derived.by(() => {
    if (!birthDate) return null
    if (secretModeStore.enabled) return '****-**-**'
    const d = new Date(birthDate)
    if (isNaN(d.getTime())) return null
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
  })

  let genderLabel = $derived(gender ? (GENDER_LABELS[gender] ?? null) : null)
</script>

{#if birthLabel || genderLabel}
  <div class="flex items-center gap-1.5 whitespace-nowrap {className}">
    {#if birthLabel}
      <span>{birthLabel}</span>
    {/if}
    {#if birthLabel && genderLabel}
      <span class="h-2.5 w-px shrink-0 bg-gray-300" aria-hidden="true"></span>
    {/if}
    {#if genderLabel}
      <span>{genderLabel}</span>
    {/if}
  </div>
{:else}
  <span class={className}>-</span>
{/if}
