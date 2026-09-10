<script lang="ts">
  /**
   * 내담자 요약 표기 — `생년월일 | 성별` 단일 규격.
   * 목록·카드·테이블 어디서든 이 컴포넌트를 쓴다(표기가 갈라지지 않도록).
   * 나이는 목록에 싣지 않는다 — 내담자 상세에서만 노출.
   * 시크릿 모드 마스킹까지 내부에서 처리한다.
   */
  import Typography, {
    type TypographyVariant
  } from '@common/components/Typography.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'

  interface Props {
    /** 'YYYY-MM-DD' 등 Date로 파싱 가능한 문자열 */
    birthDate?: string | null
    /** male/female · M/F · MALE/FEMALE · 남자/여자 모두 허용 */
    gender?: string | null
    /** 화면별 크기 조절 (기본 15px) */
    variant?: TypographyVariant
    color?: string
    class?: string
  }

  let {
    birthDate = null,
    gender = null,
    variant = 'body-02-normal-regular',
    color = 'text-body-default',
    class: className = ''
  }: Props = $props()

  const birthLabel = $derived(
    birthDate ? ($isSecretMode ? '****-**-**' : birthDate) : null
  )

  const genderLabel = $derived(
    ['female', 'F', 'FEMALE', '여자', '여'].includes(gender ?? '')
      ? '여'
      : ['male', 'M', 'MALE', '남자', '남'].includes(gender ?? '')
        ? '남'
        : null
  )
</script>

{#if birthLabel || genderLabel}
  <!-- min-w-0 + truncate-safe — 부모가 좁아지면 상자만 줄고 글자는 그대로 흘러넘쳐
       옆 요소(횟수·버튼)를 침범하던 문제. 줄어드는 건 긴 생년월일 쪽이고
       성별은 짧아 항상 남긴다(shrink-0). -->
  <div class="flex min-w-0 items-center gap-1.5 whitespace-nowrap {className}">
    {#if birthLabel}
      <Typography {variant} {color} tag="span" className="truncate-safe min-w-0"
        >{birthLabel}</Typography
      >
    {/if}
    {#if birthLabel && genderLabel}
      <span class="h-2.5 w-px shrink-0 bg-gray-300" aria-hidden="true"></span>
    {/if}
    {#if genderLabel}
      <Typography {variant} {color} tag="span" className="shrink-0"
        >{genderLabel}</Typography
      >
    {/if}
  </div>
{/if}
