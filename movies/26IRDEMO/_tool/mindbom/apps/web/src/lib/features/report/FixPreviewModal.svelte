<script lang="ts">
  // AI 수정안 미리보기 — 적용 전 임상가 확인 단계.
  //
  // CDSS 원칙(AI는 초안까지, 최종 확정은 임상가)상 AI가 본문을 직접 바꾸지 않는다.
  // 여기서 before/after를 확인하고 명시적으로 승인해야 반영된다.

  import BaseModal from '$components/modal/BaseModal.svelte'
  import type { OverallIssue, IssueFix } from './overall-review'

  let {
    issue = null,
    fix = null,
    /** 치환 대상 문단의 현재 전문 (replace일 때 맥락 표시용) */
    contextText = '',
    /** 대상 문단이 속한 섹션 제목 — "문서 어디를 고치는지" 표시용 */
    section = '',
    /** 실제 A4 지면을 복제한 조각 (html + 대상 문단의 세로 위치) */
    clip = null,
    /** 치환이 적용될 곳의 개수 — "문서 전체"라는 모호한 표현 대신 정확히 알린다 */
    matchCount = 0,
    onconfirm,
    closeModal
  } = $props<{
    issue?: OverallIssue | null
    fix?: IssueFix | null
    contextText?: string
    section?: string
    clip?: { html: string; offsetY: number } | null
    matchCount?: number
    /** 적용을 시도하고 성공 여부를 돌려준다. false면 모달을 열어 둔다. */
    onconfirm?: () => boolean | void
    /** modalStore가 주입한다 */
    closeModal?: () => void
  }>()

  /**
   * 적용에 실패하면 모달을 닫지 않는다 — 무엇이 잘못됐는지(스낵바) 보면서
   * 다시 시도하거나 취소할 수 있어야 한다. onconfirm이 false를 주는 경우다.
   */
  function confirm() {
    if (onconfirm?.() === false) return
    closeModal?.()
  }

  /**
   * 조각 창 안에서 대상 문단이 세로 가운데 오도록 밀어 올릴 거리(px).
   *
   * 페이지에서 넘겨준 offsetY는 **수정안 반영 전** 좌표라, 초안이 삽입되면
   * 문단 높이가 달라져 어긋난다. 그래서 복제본이 DOM에 붙은 뒤 실제 위치를
   * 다시 잰다(clipEl). 실측 전에는 넘겨받은 값으로 대략 맞춘다.
   */
  const CLIP_H = 280
  /** 지면 축소 배율 — CSS의 --clip-scale과 같은 값이어야 한다 */
  const CLIP_SCALE = 0.9

  let pageEl = $state<HTMLElement | null>(null)
  let measuredY = $state<number | null>(null)

  $effect(() => {
    // clip이 바뀌면 다시 잰다
    void clip
    measuredY = null
    if (!pageEl) return
    // 렌더 완료 후 실측 (스케일이 적용된 좌표가 나온다)
    requestAnimationFrame(() => {
      const el = pageEl?.querySelector<HTMLElement>('.clip-focus')
      if (!el || !pageEl) return
      const y = el.getBoundingClientRect().top - pageEl.getBoundingClientRect().top
      measuredY = y + el.getBoundingClientRect().height / 2
    })
  })

  let clipY = $derived.by(() => {
    // 실측값은 이미 축소 좌표, 넘겨받은 값은 원본 좌표
    const y = measuredY ?? (clip?.offsetY ?? 0) * CLIP_SCALE
    return Math.max(0, y - CLIP_H / 2)
  })

  /**
   * replace 미리보기.
   *
   * 맥락은 실제 지면 조각(clip)이 보여주므로 여기서는 바뀌는 표현만 다룬다.
   * 대상 표현이 본문에 실제로 있는지 확인하는 역할도 겸한다 —
   * 없으면 null이 되어 '적용' 버튼이 비활성화된다.
   */
  interface Diff {
    removed: string
    added: string
  }

  let diff = $derived.by<Diff | null>(() => {
    if (!fix || fix.type !== 'replace' || !contextText) return null
    if (!contextText.includes(fix.before)) return null
    return { removed: fix.before, added: fix.after }
  })

  /** insert 미리보기 — 삽입될 섹션명 (section이 없으면 issue.title에서 뽑는다) */
  let sectionName = $derived(
    section || (issue?.title?.replace(/이\(가\) 비어 있습니다$/, '').trim() ?? '')
  )
</script>

{#if fix}
  <BaseModal
    {closeModal}
    containerClass="max-h-[85vh]"
    bodyClass="bg-gray-50 px-5 py-4"
    headerClass="px-5 py-3.5"
    footerClass="flex items-center justify-end gap-2 px-5 py-3"
  >
    {#snippet header()}
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="material-icons-round text-[17px] text-gray-500"
            >auto_fix_high</span
          >
          <h3 class="text-body-01-normal-bold text-gray-900">{fix.label}</h3>
        </div>
        {#if issue}
          <p class="mt-0.5 truncate text-label-01-reading-regular text-gray-500">
            {issue.title}
          </p>
        {/if}
      </div>
    {/snippet}

    {#snippet body()}
      {#if fix.type === 'insert'}
        <p class="mb-2 text-label-01-reading-semibold text-gray-500">
          삽입될 내용{#if sectionName}<span class="ml-1 font-normal text-gray-400"
              >· {sectionName}</span
            >{/if}
        </p>
        {#if clip}
          <!-- 초안이 실제로 삽입된 모습을 지면 위에서 그대로 보여준다 -->
          <div class="paper-window">
            <div class="paper-scroll" style="--clip-y:{clipY}px">
              <!-- workspace 클래스가 있어야 에디터 본문 스타일(.workspace 하위로
                   스코프됨)이 그대로 적용된다. eslint-disable-next-line svelte/no-at-html-tags -->
              <div bind:this={pageEl} class="paper-page workspace">{@html clip.html}</div>
            </div>
          </div>
        {:else}
          <div
            class="rounded-lg bg-white px-3.5 py-3 text-label-01-reading-regular ring-1 ring-gray-200"
          >
            <mark class="clip-ins">{fix.text}</mark>
          </div>
        {/if}
        <p class="mt-3 text-label-01-reading-regular text-gray-500">
          비어 있는 섹션에 삽입됩니다. 삽입 후 자유롭게 편집할 수 있습니다.
        </p>
      {:else if diff}
        <p class="mb-2 text-label-01-reading-semibold text-gray-500">
          변경 내용{#if section}<span class="ml-1 font-normal text-gray-400">· {section}</span
            >{/if}
        </p>

        {#if clip}
          <!-- 실제 A4 지면을 복제한 조각. 대상 문단은 배경으로 강조하고,
               창 위아래 페이드로 "여기서 생략됐다"를 알린다. -->
          <div class="paper-window">
            <div class="paper-scroll" style="--clip-y:{clipY}px">
              <!-- workspace 클래스가 있어야 에디터 본문 스타일(.workspace 하위로
                   스코프됨)이 그대로 적용된다. eslint-disable-next-line svelte/no-at-html-tags -->
              <div bind:this={pageEl} class="paper-page workspace">{@html clip.html}</div>
            </div>
          </div>
        {/if}

        <!-- 적용 범위 — "문서 전체"는 몇 군데인지 몰라 오해를 부른다.
             같은 표현이 다른 곳에도 있으면 함께 바뀐다는 점을 정확히 알린다. -->
        <p class="mt-2.5 text-label-01-reading-regular text-gray-500">
          {#if matchCount > 1}
            같은 표현이 <b class="font-semibold text-gray-700">{matchCount}곳</b>에 있어 모두
            바뀝니다.
          {:else}
            이 문단의 해당 표현 <b class="font-semibold text-gray-700">1곳</b>만 바뀝니다.
          {/if}
        </p>
      {:else}
        <div class="rounded-lg border border-orange-200 bg-orange-50 p-3.5">
          <p class="text-body-03-reading-regular text-orange-900">
            대상 표현을 본문에서 찾지 못했습니다. 본문이 수정되었을 수
            있습니다.
          </p>
        </div>
      {/if}

      <!-- CDSS 고지 -->
      <div class="mt-4 flex items-start gap-2 rounded-lg bg-gray-100 p-3">
        <span class="material-icons-round mt-px text-[15px] text-gray-500"
          >info</span
        >
        <p class="text-label-02-reading-regular text-gray-600">
          AI 제안은 작성 보조를 위한 참고 정보입니다. 내용의 임상적 타당성은
          임상가가 검토하여 판단해 주세요. 적용 후에도 되돌리기(Ctrl+Z)가
          가능합니다.
        </p>
      </div>
    {/snippet}

    {#snippet footer()}
      <button
        class="rounded-lg px-3.5 py-2 text-body-03-normal-medium text-gray-600 transition hover:bg-gray-100"
        onclick={closeModal}
      >
        취소
      </button>
      <button
        class="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-body-03-normal-semibold text-white transition hover:bg-primary-600 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        disabled={fix.type === 'replace' && !diff}
        onclick={confirm}
      >
        <span class="material-icons-round text-[16px]">check</span>
        본문에 적용
      </button>
    {/snippet}
  </BaseModal>
{/if}

<style>
  /* ── 실제 A4 지면을 오려낸 조각 ──
     PaginatedEditor의 페이지 DOM을 그대로 복제해 넣는다. 폭 794px 지면을
     모달 폭에 맞춰 축소하고, 대상 문단이 창 가운데 오도록 밀어 올린다. */
  .paper-window {
    /* 지면 축소 배율 — JS의 CLIP_SCALE과 같은 값이어야 한다 */
    --clip-scale: 0.9;
    position: relative;
    height: 280px;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #fff;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.04),
      0 8px 20px -12px rgba(0, 0, 0, 0.12);
  }
  /* 위아래 잘린 단면 — 내용이 창 밖으로 이어진다는 신호.
     흰색으로 서서히 덮어 "여기서 생략됐다"를 표현한다. */
  .paper-window::before,
  .paper-window::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 52px;
    pointer-events: none;
    z-index: 2;
  }
  .paper-window::before {
    top: 0;
    background: linear-gradient(
      to bottom,
      #fff 18%,
      rgba(255, 255, 255, 0.85) 45%,
      rgba(255, 255, 255, 0)
    );
  }
  .paper-window::after {
    bottom: 0;
    background: linear-gradient(
      to top,
      #fff 18%,
      rgba(255, 255, 255, 0.85) 45%,
      rgba(255, 255, 255, 0)
    );
  }

  /* --clip-y는 이미 축소 배율이 반영된 값이라 그대로 뺀다 */
  .paper-scroll {
    transform: translateY(calc(var(--clip-y) * -1));
    /* transform은 레이아웃 공간을 차지하지 않아 축소해도 원래 폭(794px)만큼
       자리를 먹는다 → 오른쪽이 잘려 보인다. 남는 폭을 음수 마진으로 회수한다. */
    margin-right: calc(794px * (1 - var(--clip-scale)) * -1);
  }
  /* 794px 지면을 모달 폭에 맞춰 축소.
     패딩은 원본 .page와 동일하게 둔다 — 다르게 주면 좌표가 어긋난다.
     .workspace 클래스를 함께 주므로 에디터 본문 스타일이 그대로 적용된다.
     다만 workspace 자체의 레이아웃(flex/gap/padding)은 여기서 덮어쓴다.

     (남는 폭은 .paper-scroll의 음수 마진으로 회수한다) */
  .paper-page.workspace {
    width: 794px;
    transform: scale(var(--clip-scale));
    transform-origin: top left;
    padding: 72px 64px;
    display: block;
    background: #fff;
  }

  /* 지면 내용은 흐리지 않는다 — 문단을 가리는 게 목적이 아니라
     "위아래가 잘려 이어진다"를 알리는 것이므로 창 가장자리 페이드로만 표현한다.
     대상 문단은 배경으로 표시해 어디가 바뀌는지 알린다. */
  .paper-page.workspace :global(.para.clip-focus) {
    position: relative;
  }
  .paper-page.workspace :global(.para.clip-focus)::before {
    content: '';
    position: absolute;
    inset: -4px -10px;
    background: rgba(139, 92, 246, 0.07);
    border-left: 2px solid rgba(139, 92, 246, 0.5);
    border-radius: 3px;
    pointer-events: none;
  }

  /* 삭제될 표현 — 복제된 지면 HTML 안에서만 쓰이므로 :global만 필요하다
     ({@html} 내용은 Svelte가 정적 분석하지 못해 일반 셀렉터는 미사용으로 잡힌다) */
  .paper-page :global(.clip-del) {
    color: #b91c1c;
    background: #fef2f2;
    text-decoration: line-through;
    text-decoration-color: #fca5a5;
    text-decoration-thickness: 1.5px;
    border-radius: 3px;
    padding: 0 2px;
  }
  /* 새로 들어갈 표현 — 형광펜으로 덧쓴 느낌 */
  .clip-ins,
  .paper-page :global(.clip-ins) {
    color: #065f46;
    background: #d1fae5;
    font-weight: 600;
    border-radius: 3px;
    padding: 0 2px;
    margin-left: 2px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
</style>
