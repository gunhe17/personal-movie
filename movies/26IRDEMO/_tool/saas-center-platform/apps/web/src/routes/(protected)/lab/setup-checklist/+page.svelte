<script lang="ts">
  import { fly, slide } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'

  // 랩 — mock 데이터만. 실제 쿼리(room/program/member) 연동 없음.
  const ITEMS = [
    { label: '상담실 등록', desc: '상담이 이뤄질 공간을 등록해요', href: '#' },
    {
      label: '프로그램 등록',
      desc: '상담 프로그램과 담당자·금액을 정해요',
      href: '#'
    },
    { label: '구성원 초대', desc: '함께 일할 전문가를 초대해요', href: '#' }
  ]

  // 완료 개수 시뮬레이터 (0~3)
  let doneCount = $state(1)
  const items = $derived(ITEMS.map((it, i) => ({ ...it, done: i < doneCount })))
  const total = ITEMS.length
  const remaining = $derived(total - doneCount)
  const progress = $derived(doneCount / total)
  const nextItem = $derived(items.find((i) => !i.done))

  // 재미요소 — 남은 개수에 따라 말투가 바뀐다
  const whisper = $derived(
    remaining === total
      ? '여기부터 시작해요'
      : remaining === 2
        ? '좋아요, 두 걸음 남았어요'
        : remaining === 1
          ? '마지막 하나예요'
          : '세팅 완료예요'
  )
  const headline = $derived(
    remaining === 0 ? '센터 세팅을 마쳤어요' : '센터 첫 세팅'
  )

  // 진행 링
  const R = 20
  const C = 2 * Math.PI * R

  let expanded = $state(false)
</script>

{#snippet chevron()}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M6 3.5L10.5 8L6 12.5"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

{#snippet check(size: number)}
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
    <path
      d="M2.5 6.5L5 9L9.5 3.5"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

<div class="relative min-h-full bg-white">
  <!-- 대시보드와 동일한 앰비언트 그라데이션 (톤 비교용) -->
  <div
    class="pointer-events-none absolute -left-10 -right-10 -top-5 bottom-0 -z-0"
    aria-hidden="true"
    style="background:
      radial-gradient(60% 45% at 50% 42%, color-mix(in srgb, var(--color-primary-500) 22%, transparent) 0%, transparent 62%),
      radial-gradient(46% 38% at 78% 60%, color-mix(in srgb, var(--color-imomtae) 6%, transparent) 0%, transparent 66%);"
  ></div>

  <div class="relative z-10 mx-auto flex max-w-3xl flex-col pb-20">
    <!-- 컨트롤 -->
    <div
      class="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-white/80 p-3 backdrop-blur"
    >
      <Typography variant="body-03-normal-medium" color="text-gray-500">
        완료 개수
      </Typography>
      {#each [0, 1, 2, 3] as n}
        <button
          type="button"
          class="h-8 w-8 rounded-lg text-body-03-normal-medium transition
            {doneCount === n
            ? 'bg-primary-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
          onclick={() => (doneCount = n)}
        >
          {n}
        </button>
      {/each}
      <Typography variant="label-02-normal-regular" color="text-gray-400">
        3 = 전부 완료(실제로는 카드가 사라짐)
      </Typography>
    </div>

    <!-- 인사 (대시보드 실제 상단) -->
    <div class="pt-8">
      <Typography variant="body-02-normal-regular" color="text-gray-400">
        마인드스코프 심리상담센터 · 7월 29일 (수)
      </Typography>
      <Typography
        variant="display-01-normal-bold"
        color="text-gray-900"
        className="mt-3 block"
      >
        김상담님,
      </Typography>
      <Typography
        variant="headline-02-normal-regular"
        color="text-gray-500"
        className="mt-2 block"
      >
        좋은 오후예요
      </Typography>
    </div>

    <!-- ══════════ A안 ══════════ -->
    <div class="mt-14">
      <span
        class="inline-flex rounded-full bg-gray-900 px-2.5 py-1 text-label-02-normal-medium text-white"
        >A안 — 진행 링 + 속삭임</span
      >
    </div>

    <div class="relative mt-6">
      <!-- 속삭임 말풍선 (히어로 회기 카드와 동일 패턴) -->
      <div class="absolute -top-3.5 left-6 z-20">
        <div class="relative rounded-lg bg-gray-900 px-3 py-1.5 shadow-md">
          <span class="text-body-03-normal-medium text-white">{whisper}</span>
          <span
            class="absolute -bottom-1 left-5 h-2 w-2 rotate-45 bg-gray-900"
            aria-hidden="true"
          ></span>
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div class="flex items-center gap-5">
          <!-- 진행 링 -->
          <div class="relative h-14 w-14 shrink-0">
            <svg class="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r={R}
                fill="none"
                stroke="var(--color-gray-200)"
                stroke-width="4"
              />
              <circle
                cx="24"
                cy="24"
                r={R}
                fill="none"
                stroke="var(--color-primary-500)"
                stroke-width="4"
                stroke-linecap="round"
                stroke-dasharray={C}
                stroke-dashoffset={C * (1 - progress)}
                style="transition: stroke-dashoffset 500ms cubic-bezier(0.2,0.8,0.2,1)"
              />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-body-02-normal-bold text-gray-900">
                {doneCount}<span
                  class="text-label-02-normal-regular text-gray-400"
                  >/{total}</span
                >
              </span>
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <Typography variant="body-01-normal-semibold" color="text-gray-800">
              {headline}
            </Typography>
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-500"
              className="mt-1 block"
            >
              {#if nextItem}
                다음은 <span class="text-gray-800">{nextItem.label}</span>이에요
              {:else}
                모든 준비를 마쳤어요
              {/if}
            </Typography>
          </div>

          <button
            type="button"
            class="shrink-0 rounded p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
            aria-label="세팅 안내 닫기"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <hr class="my-4 border-gray-100" />

        <div class="flex flex-col">
          {#each items as item (item.label)}
            <a
              href={item.href}
              class="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50"
            >
              {#if item.done}
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-700 text-white"
                  aria-label="완료"
                >
                  {@render check(11)}
                </span>
              {:else}
                <span
                  class="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-gray-300"
                  aria-hidden="true"
                ></span>
              {/if}
              <span
                class="min-w-0 flex-1 truncate-safe text-body-02-normal-medium
                  {item.done ? 'text-gray-400' : 'text-gray-800'}"
              >
                {item.label}
              </span>
              {#if !item.done}
                <span
                  class="shrink-0 text-gray-300 transition-colors group-hover:text-primary-500"
                  aria-hidden="true">{@render chevron()}</span
                >
              {/if}
            </a>
          {/each}
        </div>
      </div>
    </div>

    <!-- ══════════ B안 ══════════ -->
    <div class="mt-16">
      <span
        class="inline-flex rounded-full bg-gray-900 px-2.5 py-1 text-label-02-normal-medium text-white"
        >B안 — 세그먼트 레일 + 3칸</span
      >
    </div>

    <div class="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex items-baseline justify-between">
        <Typography variant="body-01-normal-semibold" color="text-gray-800">
          {headline}
        </Typography>
        <Typography variant="body-03-normal-regular" color="text-gray-400">
          {whisper}
        </Typography>
      </div>

      <!-- 세그먼트 레일 -->
      <div class="mt-3.5 flex gap-1.5">
        {#each items as item (item.label)}
          <span
            class="h-1.5 flex-1 rounded-full transition-colors duration-500
              {item.done ? 'bg-primary-500' : 'bg-gray-200'}"
            aria-hidden="true"
          ></span>
        {/each}
      </div>

      <div class="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {#each items as item, i (item.label)}
          {@const isNext = !item.done && item === nextItem}
          <a
            href={item.href}
            class="group relative flex flex-col gap-2 rounded-lg p-4 ring-1 ring-inset transition
              {item.done
              ? 'bg-gray-50 ring-gray-200'
              : isNext
                ? 'bg-white ring-primary-400 hover:shadow-md'
                : 'bg-white ring-gray-200 hover:ring-primary-400 hover:shadow-sm'}"
          >
            {#if isNext}
              <span
                class="absolute right-3 top-3 rounded-full bg-primary-500 px-2 py-0.5 text-label-02-normal-medium text-white"
                >다음</span
              >
            {/if}
            {#if item.done}
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full bg-green-700 text-white"
                aria-label="완료"
              >
                {@render check(13)}
              </span>
            {:else}
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-body-03-normal-medium text-gray-500"
              >
                {i + 1}
              </span>
            {/if}
            <span class="min-w-0">
              <span
                class="block truncate-safe text-body-02-normal-medium
                  {item.done ? 'text-gray-400' : 'text-gray-800'}"
              >
                {item.label}
              </span>
              <span
                class="mt-0.5 block truncate-safe text-body-03-normal-regular text-gray-400"
              >
                {item.done ? '완료했어요' : item.desc}
              </span>
            </span>
          </a>
        {/each}
      </div>
    </div>

    <!-- ══════════ C안 ══════════ -->
    <div class="mt-16">
      <span
        class="inline-flex rounded-full bg-gray-900 px-2.5 py-1 text-label-02-normal-medium text-white"
        >C안 — 한 줄 제안 + 펼치기 (신호 섹션과 동형)</span
      >
    </div>

    <div class="mt-6">
      <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          class="group flex w-full items-center gap-3.5 p-6 text-left"
          onclick={() => (expanded = !expanded)}
        >
          <!-- 진행 점 (신호 섹션의 dot 어휘를 진행 표시로) -->
          <span class="flex shrink-0 gap-1" aria-hidden="true">
            {#each items as item (item.label)}
              <span
                class="h-2.5 w-2.5 rounded-full transition-colors duration-500
                  {item.done ? 'bg-primary-500' : 'bg-gray-200'}"
              ></span>
            {/each}
          </span>
          <span class="min-w-0 flex-1">
            <span
              class="block truncate-safe text-body-01-normal-medium text-gray-800"
            >
              {#if nextItem}
                {nextItem.label}부터 해볼까요?
              {:else}
                센터 세팅을 마쳤어요
              {/if}
            </span>
            <span
              class="mt-0.5 block text-body-03-normal-regular text-gray-400"
            >
              센터 첫 세팅 {doneCount}/{total} · {whisper}
            </span>
          </span>
          <span
            class="shrink-0 text-gray-300 transition-transform duration-200 group-hover:text-gray-500
              {expanded ? 'rotate-90' : ''}"
            aria-hidden="true">{@render chevron()}</span
          >
        </button>

        {#if expanded}
          <div transition:slide={{ duration: 180 }}>
            <hr class="border-gray-100" />
            <div class="flex flex-col p-3">
              {#each items as item (item.label)}
                <a
                  href={item.href}
                  class="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50"
                >
                  {#if item.done}
                    <span
                      class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-700 text-white"
                      aria-label="완료"
                    >
                      {@render check(11)}
                    </span>
                  {:else}
                    <span
                      class="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-gray-300"
                      aria-hidden="true"
                    ></span>
                  {/if}
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate-safe text-body-02-normal-medium
                        {item.done ? 'text-gray-400' : 'text-gray-800'}"
                    >
                      {item.label}
                    </span>
                    <span
                      class="block truncate-safe text-body-03-normal-regular text-gray-400"
                    >
                      {item.done ? '완료했어요' : item.desc}
                    </span>
                  </span>
                  {#if !item.done}
                    <span
                      class="shrink-0 text-gray-300 transition-colors group-hover:text-primary-500"
                      aria-hidden="true">{@render chevron()}</span
                    >
                  {/if}
                </a>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- 아래 히어로 (톤 비교용 — 실제 대시보드 다음 섹션) -->
    <div class="mt-16" in:fly={{ y: 16, duration: 450 }}>
      <Typography
        variant="body-02-normal-medium"
        color="text-gray-500"
        className="mb-3 block"
      >
        다가오는 회기
      </Typography>
      <div
        class="flex items-stretch rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div class="flex w-14 shrink-0 flex-col items-center pt-0.5">
          <Typography variant="headline-02-normal-bold" color="text-gray-900">
            14:00
          </Typography>
          <span class="my-1.5 h-3 w-px bg-gray-300" aria-hidden="true"></span>
          <Typography variant="body-01-normal-regular" color="text-gray-400">
            14:50
          </Typography>
        </div>
        <span class="mx-5 w-px self-stretch bg-gray-200" aria-hidden="true"
        ></span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="h-2 w-2 shrink-0 rounded-full bg-green-500"
              aria-hidden="true"
            ></span>
            <Typography variant="headline-02-normal-bold" color="text-gray-900">
              양지원
            </Typography>
          </div>
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-600"
            className="ml-4 mt-1 block"
          >
            여 · 만 9세
          </Typography>
        </div>
      </div>
    </div>
  </div>
</div>
