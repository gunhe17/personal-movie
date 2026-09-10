<script lang="ts">
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'

  type MockClient = {
    id: string
    name: string
    birthDate: string
    age: number
    gender: 'male' | 'female'
    completed: number
  }

  // ── 목업: 그룹 상담 케이스 (내담자 3명) ──
  const clients: MockClient[] = [
    {
      id: '1',
      name: '김민준',
      birthDate: '2015-03-12',
      age: 10,
      gender: 'male',
      completed: 4
    },
    {
      id: '2',
      name: '이서연',
      birthDate: '2016-07-08',
      age: 9,
      gender: 'female',
      completed: 3
    },
    {
      id: '3',
      name: '박도윤',
      birthDate: '2015-11-20',
      age: 10,
      gender: 'male',
      completed: 5
    }
  ]
  const totalSessions = 8
  const info = {
    program: '놀이치료 - 그룹',
    counselor: '김은지',
    start: '2026-05-02 (금) 14:00',
    done: '-'
  }
  const g = (x: 'male' | 'female') => (x === 'female' ? '여' : '남')
</script>

<!-- ─────────── 공용 조각 ─────────── -->
{#snippet infoGrid()}
  <div class="mb-4 flex items-center justify-between">
    <Typography variant="title-01-normal-semibold" color="text-gray-900">
      상담 정보
    </Typography>
    <span class="text-gray-400"><EditIcon /></span>
  </div>
  <div
    class="grid grid-cols-[auto_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-3"
  >
    <div class="flex min-h-5 items-center">
      <Typography variant="body-02-normal-regular" color="text-gray-600"
        >프로그램</Typography
      >
    </div>
    <div class="flex min-h-5 items-center">
      <Typography variant="body-02-normal-regular" color="text-gray-800"
        >{info.program}</Typography
      >
    </div>
    <div class="flex min-h-5 items-center">
      <Typography variant="body-02-normal-regular" color="text-gray-600"
        >담당자</Typography
      >
    </div>
    <div class="flex min-h-5 items-center">
      <Typography variant="body-02-normal-regular" color="text-gray-800"
        >{info.counselor}</Typography
      >
    </div>
    <div class="flex min-h-5 items-center">
      <Typography variant="body-02-normal-regular" color="text-gray-600"
        >시작 일정</Typography
      >
    </div>
    <div class="flex min-h-5 items-center">
      <Typography variant="body-02-normal-regular" color="text-gray-800"
        >{info.start}</Typography
      >
    </div>
    <div class="flex min-h-5 items-center">
      <Typography variant="body-02-normal-regular" color="text-gray-600"
        >완료일</Typography
      >
    </div>
    <div class="flex min-h-5 items-center">
      <Typography variant="body-02-normal-regular" color="text-gray-800"
        >{info.done}</Typography
      >
    </div>
  </div>
{/snippet}

{#snippet clientCard(c: MockClient, withProfile: boolean)}
  <button
    class="flex h-[71px] w-full items-center {withProfile
      ? 'gap-3'
      : 'justify-between'} rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
  >
    {#if withProfile}
      <ClientAvatar
        name={c.name}
        gender={c.gender}
        sizeClass="h-10 w-10 shrink-0"
        textClass="text-[15px]"
      />
    {/if}
    <div class="min-w-0 {withProfile ? 'flex-1' : ''}">
      <Typography variant="body-01-normal-semibold" color="text-gray-800">
        {c.name}
      </Typography>
      <div class="mt-1 flex items-center gap-1.5 whitespace-nowrap">
        <Typography variant="body-02-normal-regular" color="text-gray-600">
          {c.birthDate} (만 {c.age}세)
        </Typography>
        <span class="h-2.5 w-px bg-gray-300" aria-hidden="true"></span>
        <Typography variant="body-02-normal-regular" color="text-gray-600">
          {g(c.gender)}
        </Typography>
      </div>
    </div>
    <Typography
      variant="body-03-normal-regular"
      color="text-gray-500"
      className="shrink-0"
    >
      {c.completed}/{totalSessions}회
    </Typography>
  </button>
{/snippet}

{#snippet clientSection(withProfile: boolean)}
  <div class="mb-5 flex items-center gap-1.5">
    <Typography variant="title-01-normal-semibold" color="text-gray-900"
      >내담자</Typography
    >
    <Typography variant="body-03-normal-regular" color="text-gray-600"
      >{clients.length}</Typography
    >
  </div>
  <div class="space-y-2">
    {#each clients as c (c.id)}
      {@render clientCard(c, withProfile)}
    {/each}
  </div>
{/snippet}

{#snippet breadcrumb()}
  <div class="mb-3 flex items-center gap-2 text-body-02-normal-medium">
    <span class="text-gray-500">상담</span>
    <span class="text-gray-400">›</span>
    <span class="text-gray-800">{info.program}</span>
  </div>
{/snippet}

<!-- ─────────── 페이지 ─────────── -->
<div
  in:fade
  class="flex h-full w-full flex-col overflow-y-auto bg-gray-50 pb-12"
>
  <div class="mb-6 shrink-0">
    <Typography variant="headline-01-normal-semibold" color="text-gray-900">
      상담 상세 좌측 패널 — Lab
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-500"
      className="mt-2 block"
    >
      상단 내담자 헤더(=대표 1명)가 아래 내담자 카드와 정보가 중복되고, 그룹에선
      대표 한 명만 최상단에 떠 어색하다는 피드백 반영. <b>시안</b>은 상단 헤더를
      없애고 상담 정보를 먼저, 내담자 카드엔 프로필(아바타)을 추가했어요. 페이지
      정체성은 상단 브레드크럼(상담 › 프로그램)이 이미 담당합니다.
    </Typography>
  </div>

  <div class="flex flex-wrap items-start gap-6">
    <!-- 현재 -->
    <div class="w-[420px] max-w-full shrink-0">
      <p class="mb-3 text-label-01-normal-medium text-gray-400">
        현재 — 상단 내담자 헤더 + 내담자 카드(정보 중복)
      </p>
      {@render breadcrumb()}
      <div class="flex flex-col rounded-2xl border border-gray-200 bg-white">
        <!-- 상단 내담자 헤더 (그룹이라도 대표 1명만) -->
        <div class="border-b border-gray-200 p-6">
          <div class="flex items-center gap-3">
            <ClientAvatar
              name={clients[0].name}
              gender={clients[0].gender}
              sizeClass="h-12 w-12 shrink-0"
              textClass="text-[18px]"
            />
            <div class="min-w-0">
              <Typography
                variant="headline-02-normal-semibold"
                color="text-gray-900"
                className="truncate-safe"
              >
                {clients[0].name}
              </Typography>
              <div class="mt-1 flex items-center gap-1.5 whitespace-nowrap">
                <Typography
                  variant="body-01-normal-regular"
                  color="text-gray-500"
                >
                  {clients[0].birthDate} (만 {clients[0].age}세)
                </Typography>
                <span class="h-2.5 w-px bg-gray-300" aria-hidden="true"></span>
                <Typography
                  variant="body-01-normal-regular"
                  color="text-gray-500"
                >
                  {g(clients[0].gender)}
                </Typography>
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-col p-5">
          {@render infoGrid()}
          <div class="my-7 h-px bg-gray-200"></div>
          {@render clientSection(false)}
        </div>
      </div>
      <p class="mt-2 text-label-02-normal-regular text-red-400">
        ⚠ 상단 "{clients[0].name}"와 아래 첫 카드가 이름·생년월일·성별 중복.
        그룹인데 대표 1명만 최상단.
      </p>
    </div>

    <!-- 시안 -->
    <div class="w-[420px] max-w-full shrink-0">
      <p class="mb-3 text-label-01-normal-medium text-primary-500">
        시안 — 상담 정보 우선 + 내담자 카드에 프로필 추가
      </p>
      {@render breadcrumb()}
      <div class="flex flex-col rounded-2xl border border-primary-200 bg-white">
        <div class="flex flex-col p-6">
          {@render infoGrid()}
          <div class="my-7 h-px bg-gray-200"></div>
          {@render clientSection(true)}
        </div>
      </div>
      <p class="mt-2 text-label-02-normal-regular text-primary-500">
        ✓ 중복 제거 · 그룹 전원이 동등하게 카드로 · 프로필로 인지성 유지 ·
        정체성은 상담 정보/브레드크럼이 담당
      </p>
    </div>
  </div>
</div>
