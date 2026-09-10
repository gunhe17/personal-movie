<script lang="ts">
  import ToolResultTable from '$lib/features/agent/chat/components/ToolResultTable.svelte'
  import SelectionList from '$lib/features/agent/chat/components/SelectionList.svelte'
  import CheckpointForm from '$lib/features/agent/chat/components/CheckpointForm.svelte'
  import SendButton from '$lib/features/agent/chat/components/SendButton.svelte'
  import type { FormFieldDef } from '$lib/features/agent/chat/types'
  import { renderMessageMarkdown } from '$lib/features/agent/chat/view-model'

  // ── mock 데이터 (dot-prefix 키 = 백엔드 봉투 형태) ──
  const clientRows = [
    {
      'client.name': '이하준',
      'client.code': 'C01004',
      'client.birth_date': '2018-05-15',
      'client.gender': 'male',
      'client.phone': '010-1111-2222',
      'client.status': 'active'
    },
    {
      'client.name': '김민준',
      'client.code': 'C00990',
      'client.birth_date': '2019-03-02',
      'client.gender': 'male',
      'client.phone': '010-3333-4444',
      'client.status': 'active'
    },
    {
      'client.name': '박서연',
      'client.code': 'C01010',
      'client.birth_date': '2021-07-21',
      'client.gender': 'female',
      'client.phone': '010-5555-6666',
      'client.status': 'inactive'
    }
  ]
  const billableRows = [
    {
      'billable.client_name': '김민준',
      'billable.total_amount': 120000,
      'billable.paid_amount': 0,
      'billable.unpaid_amount': 120000,
      'billable.status': 'issued',
      'billable.billable_date': '2026-06-30'
    },
    {
      'billable.client_name': '이하준',
      'billable.total_amount': 80000,
      'billable.paid_amount': 80000,
      'billable.unpaid_amount': 0,
      'billable.status': 'paid',
      'billable.billable_date': '2026-07-01'
    }
  ]
  const memberRows = [
    {
      'member.name': '박지은',
      'member.role_code': 'COUNSELOR',
      'member.phone': '010-1234-5678',
      'member.is_active': true
    },
    {
      'member.name': '최원장',
      'member.role_code': 'MANAGER',
      'member.phone': '010-9876-5432',
      'member.is_active': true
    }
  ]

  const selectionOptions = [
    '김은서 / 2015-03-12 / 만 11세 / 남',
    '김은서 / 2012-03-12 / 만 15세 / 여'
  ]

  const scheduleFields: FormFieldDef[] = [
    { name: 'title', type: 'text', label: '일정 제목', required: true },
    { name: 'start', type: 'datetime', label: '시작 시간', required: true },
    { name: 'end', type: 'datetime', label: '종료 시간' },
    {
      name: 'room',
      type: 'select',
      label: '상담실',
      choices: ['상담실A', '놀이치료실', '검사실']
    }
  ]

  // 상호작용 로그 (콘솔 대신 화면 표시)
  let log = $state<string[]>([])
  const push = (m: string) => {
    log = [m, ...log].slice(0, 8)
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-4xl mx-auto px-6 py-10">
    <header class="pb-6 border-b border-gray-200">
      <p class="text-label-01-normal-regular text-primary-500">
        agent chat · 컴포넌트 갤러리 (dev)
      </p>
      <h1 class="mt-2 text-headline-01-normal-semibold text-gray-800">
        컴포넌트별 인터페이스 · 전 렌더 케이스
      </h1>
      <p class="mt-2 text-body-03-reading-regular text-gray-500">
        실제 컴포넌트를 mock으로 렌더. 각 케이스는 LLM 응답 형태가 프론트에서
        어떻게 보이는지의 계약.
      </p>
    </header>

    <!-- ════ 1. 메시지 렌더 (AgentChatArea 인라인) ════ -->
    <section class="mt-10">
      <h2 class="text-title-02-normal-semibold text-gray-800">
        1 · 메시지 렌더
      </h2>
      <p class="mt-1 text-label-01-normal-regular text-gray-400">
        AgentChatArea 내부 · completion_delta/conversation_done/segments
      </p>
      <div
        class="mt-4 rounded-2xl border border-gray-200 bg-white p-6 space-y-6"
      >
        <div>
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            ① user 말풍선
          </p>
          <div class="flex justify-end">
            <div class="max-w-[70%]">
              <div class="bg-gray-100 text-gray-800 rounded-lg px-4 py-2.5">
                <p class="text-body-03-reading-regular whitespace-pre-wrap">
                  김은지 내담자 검색해줘
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            ② assistant 답변 · 마크다운 강조 렌더(굵게·코드) · 목록/표는
            프롬프트로 금지
          </p>
          <div class="pr-12">
            <p
              class="text-body-03-reading-regular whitespace-pre-wrap text-gray-800"
            >
              {@html renderMessageMarkdown(
                '김은지 내담자를 찾았어요. **활성** 상태이고 코드는 `C01004` 입니다.\n줄바꿈은 유지됩니다.'
              )}
            </p>
          </div>
        </div>

        <div>
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            ③ Q./A. 세그먼트 (checkpoint 질문·답) · 개선된 칩
          </p>
          <div class="pr-12">
            <div class="my-1.5 flex items-center gap-2.5">
              <span
                class="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-label-02-normal-medium text-gray-500"
                >Q</span
              >
              <p class="text-body-03-reading-regular text-gray-600">
                어떤 내담자로 예약을 진행할까요?
              </p>
            </div>
            <div class="my-1.5 flex items-center gap-2.5">
              <span
                class="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-label-02-normal-medium text-white"
                >A</span
              >
              <p class="text-body-03-reading-regular text-gray-800">
                김은서 (만 11세)
              </p>
            </div>
          </div>
        </div>

        <div>
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            ④ 시각 · 스트림 종료 시 한 번만 (메시지마다 X)
          </p>
          <div class="pr-12">
            <p
              class="text-body-03-reading-regular whitespace-pre-wrap text-gray-800"
            >
              상담사는 박지은·이진희 2명입니다.
            </p>
            <p class="text-label-02-normal-regular text-gray-400 mt-1.5">
              오전 10:30
            </p>
          </div>
        </div>

        <div>
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            ⑤ 로딩 (progress "…")
          </p>
          <div class="pr-12 flex items-center gap-2">
            <span class="flex items-center gap-1" aria-hidden="true">
              <span
                class="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse"
              ></span>
              <span
                class="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse"
                style="animation-delay:150ms"
              ></span>
              <span
                class="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse"
                style="animation-delay:300ms"
              ></span>
            </span>
            <p class="text-body-03-reading-regular text-gray-500">
              요청을 처리하고 있습니다…
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ════ 2. ToolResultTable ════ -->
    <section class="mt-10">
      <h2 class="text-title-02-normal-semibold text-gray-800">
        2 · ToolResultTable
      </h2>
      <p class="mt-1 text-label-01-normal-regular text-gray-400">
        step_tool_result · Props {'{'} tool, output, content?, isError?, truncated?,
        limit? {'}'}
      </p>
      <div class="mt-4 space-y-4">
        <div class="rounded-2xl border border-gray-200 bg-white p-5">
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            table (N건) · client — 이름/코드/생년월일/성별/연락처/상태 배지
          </p>
          <ToolResultTable tool="query_client_handler" output={clientRows} />
        </div>

        <div class="rounded-2xl border border-gray-200 bg-white p-5">
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            card (1건) · 단일 객체 → key-value
          </p>
          <ToolResultTable tool="query_client_handler" output={clientRows[0]} />
        </div>

        <div class="rounded-2xl border border-gray-200 bg-white p-5">
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            currency · billable — 총액/납부/미수금 통화 포맷
          </p>
          <ToolResultTable
            tool="query_billable_handler"
            output={billableRows}
          />
        </div>

        <div class="rounded-2xl border border-gray-200 bg-white p-5">
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            boolean 배지 · member — is_active 활성/비활성
          </p>
          <ToolResultTable tool="query_member_handler" output={memberRows} />
        </div>

        <div class="rounded-2xl border border-gray-200 bg-white p-5">
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            empty (0건) · notFound — content가 있으면 그 문구
          </p>
          <ToolResultTable
            tool="query_client_handler"
            output={[]}
            content="조건에 맞는 내담자가 없어요."
          />
        </div>

        <div class="rounded-2xl border border-gray-200 bg-white p-5">
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            error (is_error) · 도구 실행 실패
          </p>
          <ToolResultTable
            tool="query_client_handler"
            output={{ error: 'boom' }}
            isError={true}
          />
        </div>

        <div class="rounded-2xl border border-gray-200 bg-white p-5">
          <p class="text-label-01-normal-regular text-gray-400 mb-2">
            truncated · 상한 도달 배너 (조건 좁혀주세요)
          </p>
          <ToolResultTable
            tool="query_client_handler"
            output={clientRows}
            truncated={true}
            limit={40}
          />
        </div>
      </div>
    </section>

    <!-- ════ 3. SelectionList ════ -->
    <section class="mt-10">
      <h2 class="text-title-02-normal-semibold text-gray-800">
        3 · SelectionList
      </h2>
      <p class="mt-1 text-label-01-normal-regular text-gray-400">
        checkpoint selection · Props {'{'} options, onSelect, onCancel? {'}'}
      </p>
      <div class="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-label-01-normal-regular text-gray-400 mb-2">
          번호 옵션 + 직접 입력 (ask_user options)
        </p>
        <div class="rounded-lg border border-primary-400 bg-white">
          <div class="px-5 pt-4 pb-3 border-b border-gray-100">
            <p class="text-body-02-normal-medium text-gray-800">
              어떤 내담자로 예약을 진행할까요?
            </p>
          </div>
          <div class="px-5 py-3">
            <SelectionList
              options={selectionOptions}
              onSelect={(i) => push('select: ' + JSON.stringify(i))}
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ════ 4. CheckpointForm ════ -->
    <section class="mt-10">
      <h2 class="text-title-02-normal-semibold text-gray-800">
        4 · CheckpointForm
      </h2>
      <p class="mt-1 text-label-01-normal-regular text-gray-400">
        checkpoint form (ask_user fields) · Props {'{'} fields, title?, onSubmit,
        onCancel? {'}'}
      </p>
      <div class="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-label-01-normal-regular text-gray-400 mb-2">
          다필드 폼 · text / datetime / select · 필수(*) 검증
        </p>
        <div class="rounded-lg border border-primary-400 bg-white px-6 py-5">
          <CheckpointForm
            fields={scheduleFields}
            title="일정 정보를 입력해주세요"
            onSubmit={(d) => push('form: ' + JSON.stringify(d))}
            onCancel={() => push('form cancel')}
          />
        </div>
      </div>
    </section>

    <!-- ════ 5. SendButton ════ -->
    <section class="mt-10">
      <h2 class="text-title-02-normal-semibold text-gray-800">
        5 · SendButton
      </h2>
      <p class="mt-1 text-label-01-normal-regular text-gray-400">
        Props {'{'} onClick, disabled?, type?, size? {'}'}
      </p>
      <div
        class="mt-4 rounded-2xl border border-gray-200 bg-white p-5 flex items-center gap-8"
      >
        <div class="text-center">
          <SendButton onClick={() => push('send md')} />
          <p class="text-label-02-normal-regular text-gray-400 mt-2">기본</p>
        </div>
        <div class="text-center">
          <SendButton size="sm" onClick={() => push('send sm')} />
          <p class="text-label-02-normal-regular text-gray-400 mt-2">sm</p>
        </div>
        <div class="text-center">
          <SendButton disabled onClick={() => {}} />
          <p class="text-label-02-normal-regular text-gray-400 mt-2">
            disabled
          </p>
        </div>
      </div>
    </section>

    <!-- 상호작용 로그 -->
    <section class="mt-10">
      <h2 class="text-title-02-normal-semibold text-gray-800">상호작용 로그</h2>
      <div
        class="mt-3 rounded-2xl border border-gray-200 bg-white p-4 min-h-16 font-mono text-label-01-normal-regular text-gray-600 space-y-1"
      >
        {#if log.length === 0}<p class="text-gray-300">
            위 컴포넌트를 눌러보세요 — 선택/제출 결과가 여기 뜹니다.
          </p>{/if}
        {#each log as line}<p>{line}</p>{/each}
      </div>
    </section>

    <footer
      class="mt-12 pt-6 border-t border-gray-200 text-label-02-normal-regular text-gray-400"
    >
      dev 전용 · /playground/agent · assistant flat-loop 스택
    </footer>
  </div>
</div>
