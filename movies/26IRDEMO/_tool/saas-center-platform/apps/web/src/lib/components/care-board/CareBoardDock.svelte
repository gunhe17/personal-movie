<script lang="ts">
  // ============================================================
  // 케어보드 — 우측 도크 + 진입 버튼
  // ============================================================
  //
  // 한 내담자에게 일어난 일(상담 회기·검사·문서·바우처)과 담당자들이 남긴
  // 공유 메모를 하나의 대화 스트림으로 읽고, 그 자리에서 메모를 남긴다.
  //
  // 이 컴포넌트는 **페이지 레이아웃을 건드리지 않는다** — fixed 요소 두 개
  // (닫힘: 떠 있는 진입 버튼 / 열림: 우측 도크)만 그린다. 도크가 열렸을 때
  // 본문을 줄이는 건 페이지 몫이다(`bind:open` → 루트에 `pr-[360px]`).
  // 360 = 도크 400 − 40, 셸 우측 패딩 80이 이미 있으므로 콘텐츠 ↔ 도크 = 40
  // (Web_Design.md §Spacing > 컨테이너 패딩 — 영구 크롬 80 / 열린 도크 40).
  //
  // 스트림 규약 (두 종류가 한 줄기에 섞인다):
  //   · 사람이 쓴 것(메모) = 아바타 + 이름 + 시각 → 본문      (채팅 메시지)
  //   · 시스템이 남긴 것(회기·검사·문서·바우처) = 종류 배지 + 제목 → 요약
  //   아바타 유무가 곧 "누가 썼나"의 구분이라 별도 장식이 필요 없다.
  //
  // 두 개의 뷰 — 같은 데이터, 다른 질문:
  //   · 타임라인(도크 기본) = "언제 무슨 일이 있었나". 시간순 스트림, 훑어 내려감.
  //   · 차트(헤더 버튼 → 모달) = "이 사람이 어떤 상태인가". 고정 슬롯, 찍어 읽음.
  //   전자는 흐름이고 후자는 단면이라 중복이 아니다(경과기록 ↔ 차트 요약과 같은 관계).
  //
  // 문(진입점)은 목적지가 서로 달라야 신뢰된다 — 자리로 그 범위를 말한다:
  //   · 타임라인 행(스트림 안) → 그 사건의 원본(상담 상세·검사 상세·문서)
  //   · 헤더 `차트` 버튼       → 이 내담자의 차트. 보드 전체에 대한 액션이라 헤더에 있다
  //
  // 차트를 왜 모달로 두나 — 여는 계기가 배정·인계·종결 판단 등 **저빈도 고가치**라
  // 상시 자리를 차지하면 안 된다. 매번 본다고 밝혀지면 도크에 [타임라인 | 차트]
  // 토글로 승격하면 되고, 그 방향이 되돌리기 싸다.
  //   ※ 저빈도의 진짜 위험은 "필요한 날 있는 줄 모르는 것"이다. 헤더 버튼은 세로를
  //     안 먹는 대신 그 자체로는 값을 주지 않으므로, 발견성이 부족하다고 판명되면
  //     상단 요약 카드(안 눌러도 진행률·다음 일정이 읽히는 형태)를 다시 세운다.
  //
  // 면(배경) 규율: 도크 본문은 gray-50, 흰 면은 고정 메모 카드와 입력창뿐이다.
  //
  // 스트림·메모·고정·읽음은 서버에 연결돼 있다(care-board-service).
  // ⚠️ 아직 목업인 곳은 **차트 모달 하나**뿐이다 — 아래 CHART 리터럴 참고.

  import { onMount, tick } from 'svelte'
  import { fade, fly, slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import Typography from '@common/components/Typography.svelte'
  import MemberAvatar from '$lib/components/MemberAvatar.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import AiStarIcon20 from '$lib/assets/AiStarIcon20.svelte'
  import ArrowDownIcon24 from '$lib/assets/ArrowDownIcon24.svelte'
  import GrayCircleInfoIcon16 from '$lib/assets/GrayCircleInfoIcon16.svelte'
  import CloseIcon32 from '$lib/assets/CloseIcon32.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import CareBoardLogo from './CareBoardLogo.svelte'
  import PinIcon24 from '$lib/assets/PinIcon24.svelte'
  import SendIcon24 from '$lib/assets/SendIcon24.svelte'
  import ChevronDownIcon20 from './ChevronDownIcon20.svelte'
  import { centerId } from '$lib/stores/center.store'
  import {
    createCareBoardService,
    groupByDay,
    timeLabel,
    KIND_META,
    FILTERS,
    sourceHref,
    type StreamItem
  } from '$lib/features/clients/detail/care-board'
  import { goto } from '$app/navigation'
  import { snackbarStore } from '$lib/stores/snackbar'

  interface Props {
    /** 스트림·메모의 대상 내담자 */
    clientId: string
    /** 도크 헤더에 표기할 대상 내담자 이름 */
    clientName: string
    // ── 차트 문서 헤더용 신원 3종 ──
    // 도크(스트림)에는 안 쓰이고 차트 모달의 프로필 블록에서만 쓴다. 모두 optional —
    // 없으면 이니셜 폴백·표기 생략으로 떨어지고 배치는 그대로다(빈 슬롯 유지 원칙).
    /** 'YYYY-MM-DD' */
    clientBirthDate?: string | null
    /** male/female · M/F · MALE/FEMALE · 남/여 모두 허용 (ClientBirthGender 계약) */
    clientGender?: string | null
    clientProfileImageUrl?: string | null
    /** 열림 상태 — 페이지가 본문 폭을 줄이려면 bind 한다 */
    open?: boolean
    /** 진입 시 자동으로 펼칠지 (기본 true — 아래 인트로 참고) */
    defaultOpen?: boolean
  }

  let {
    clientId,
    clientName,
    clientBirthDate = null,
    clientGender = null,
    clientProfileImageUrl = null,
    open = $bindable(false),
    defaultOpen = true
  }: Props = $props()

  // ── 인트로: 접힌 채로 그려지고 한 박자 뒤 펼쳐진다 ──
  // 열린 상태가 기본이지만 **처음부터 열려 있으면 접을 수 있다는 걸 모른다.**
  // 진입 버튼 → 도크로 넘어가는 그 한 번의 전환이 곧 토글 사용법 안내다.
  // (이후 사용자가 닫으면 닫힌 채로 둔다 — 인트로는 최초 마운트 1회뿐)
  // defaultOpen은 **발화 시점**에 다시 읽는다 — 페이지가 afterNavigate에서
  // "되돌아온 진입"으로 판정하면 마운트 직후 false로 꺼지는데, 마운트 시점에만
  // 검사하면 이미 걸린 타이머가 그대로 터져 접어둔 상태를 다시 펼쳐버린다.
  const INTRO_DELAY = 600
  onMount(() => {
    const timer = setTimeout(() => {
      if (defaultOpen) open = true
    }, INTRO_DELAY)
    return () => clearTimeout(timer)
  })

  // filter는 board보다 먼저 선언한다 — 서비스 생성 시 쿼리 옵션 getter가 즉시
  // 평가되므로, 뒤에 두면 TDZ에 걸린다.
  let filter = $state('all')

  const board = createCareBoardService({
    centerId: () => $centerId ?? '',
    clientId,
    filter: () => filter,
    // 도크가 닫혀 있으면 조회하지 않는다 — 상세 진입 시 자동으로 펼쳐지므로
    // 열림이 곧 "보고 있다"는 신호다.
    enabled: () => open
  })

  const stream = $derived(board.items)
  const pinned = $derived(board.pinned)
  const groups = $derived(groupByDay(stream))
  const newCount = $derived(board.unreadCount)

  // 열어 본 시점을 서버에 남긴다 — 다음 진입의 안 읽음 배지 기준선.
  // 열림당 1회만 — 매 렌더마다 쏘면 요청이 눌어붙는다.
  let seenMarked = $state(false)
  $effect(() => {
    if (!open) {
      seenMarked = false
      return
    }
    if (seenMarked || board.isLoading) return
    seenMarked = true
    void board.markSeen()
  })

  // ── 차트 (헤더 `차트` 버튼 → 모달) ──
  // 시안: Figma "SaaS V.2 통합" node 10968:29078
  //
  // 네 덩어리로만 읽는다:
  //   ① 신원 헤더   — 아바타 · 이름 · 생년|성별
  //   ② 기본 정보   — 주호소 문제 | 진행중인 치료 (세로 괘선 2칸)
  //   ③ AI 요약     — ②④를 바탕으로 한 **사실 요약**
  //   ④ 상담 | 검사 — 탭으로 가르고, 치료·검사별 그룹 안에 한 회기 한 줄
  //
  // 🔴 **AI는 요약만 한다 — 임상적 판단은 하지 않는다.**
  //    "무엇이 있었나"(회차·실시일·기록에 반복된 표현)까지가 AI의 몫이고,
  //    "그래서 어떤 상태인가·무엇을 해야 하나"는 소견을 쓰는 사람의 몫이다.
  //    검사 결과 수치·해석·권고는 이 화면이 만들어내지 않는다 — 소견 원문은
  //    검사 상세가 정본이고 여기서는 "작성됨/미작성"이라는 사실만 옮긴다.
  //
  // 🔴 **치료명·검사명은 배지가 아니라 타이틀로 쓴다** — 센터가 자유롭게 짓는
  //    열린 값이라 폭이 고정된 규격 어휘(배지·탭)에 안 들어간다. 배지 자리에는
  //    회차(1회기)처럼 우리가 정의한 닫힌 값만 온다.
  //
  // ⚠️ TODO(백엔드): 전부 목업. 조립 원천 —
  //    치료=counseling_cases · 회차=counseling_sessions · 요약=counseling_notes.summary
  //    검사=assessment_tasks(+.opinion 유무만) · AI 요약=counseling_case_analysis
  const CHART = {
    /** ② 기본 정보 — 진행중인 치료 목록은 counseling에서 읽는다 */
    basics: {
      chiefComplaint:
        '사람들이 많은 상황에서 긴장을 하고 자주 배가 아프다는 얘기를 한다. 최근 들어 학교에 가기 싫어한다.'
    },
    /**
     * ③ AI 요약 — **사실만.** 회차·실시 내역·기록에 반복 등장한 표현까지가
     * 한계선이고, 상태 평가·원인 추정·개입 권고는 넣지 않는다.
     */
    aiSummary: {
      period: '최근 3개월',
      text: '분리불안과 학교 거부로 접수해 놀이치료 - 그룹 4회기, 언어치료 2회기를 진행했습니다. 초기 3회기 동안 학교 주제는 기록에 나타나지 않았고, K-WISC-V 실시 이후 회기 요약에 또래관계·차례 기다리기 표현이 반복해서 등장합니다.'
    },
    /**
     * ④-상담 — 치료별 그룹. 회차는 케이스별 카운터라 그룹 안에서만 뜻이 통한다
     * (시간순으로 섞으면 번호가 튄다) — 그래서 여기서는 치료로 묶는다.
     */
    counseling: [
      {
        id: 'play',
        name: '놀이치료 - 그룹',
        done: 4,
        total: 15,
        rows: [
          {
            no: 4,
            date: '8. 20',
            line: '또래관계 역할놀이 — 갈등 상황을 스스로 언어화하는 시도'
          },
          {
            no: 3,
            date: '8. 07',
            line: '가족 그림 활동 — 아버지를 가장 크게, 본인을 가장자리에 배치'
          },
          {
            no: 2,
            date: '7. 24',
            line: '보드게임 — 차례 기다리기 어려움, 후반부 개선'
          },
          {
            no: 1,
            date: '7. 17',
            line: '라포 형성 — 낯가림 있으나 놀이에는 참여'
          }
        ]
      },
      {
        id: 'speech',
        name: '언어치료 - 개인',
        done: 2,
        total: 25,
        rows: [
          {
            no: 2,
            date: '8. 18',
            line: '조음 반복 훈련 — /ㄹ/ 초성 명료도 개선, 문장 길이는 여전히 짧음'
          },
          {
            no: 1,
            date: '8. 04',
            line: '초기 평가 — 표현어휘 지연 확인, 이해어휘는 연령 수준'
          }
        ]
      }
    ],
    /**
     * ④-검사 — 검사명으로 묶는다. 같은 검사를 다시 하면 회차가 쌓여
     * "그때와 지금"이 한 그룹 안에 나란히 놓인다.
     *
     * 행에 오는 건 **전문가가 쓴 소견의 요약**이다 — 상담 회기 요약과 같은 자리에
     * 같은 형식으로 선다. "실시 완료"는 행이 있다는 사실의 반복이라 적지 않는다.
     * 결과 수치를 뽑아 대표로 세우지 않는 이유는 그 선택 자체가 임상적 판단이기
     * 때문이고, 그 판단은 소견을 쓴 사람이 이미 했다 — 시스템은 그 글을 줄일 뿐이다.
     * `line: null` = 소견 미작성(실시는 됐다). 원문은 검사 상세가 정본.
     */
    assessment: [
      {
        id: 'wisc',
        name: 'K-WISC-V',
        rows: [
          {
            no: 1,
            date: '8. 14',
            line: '전반적 인지능력은 평균 상, 작업기억·처리속도가 상대적으로 낮아 과제가 길어지면 수행 편차가 커질 수 있음' as
              | string
              | null
          }
        ]
      },
      {
        id: 'cbcl',
        name: 'CBCL 6-18',
        rows: [
          { no: 2, date: '7. 18', line: null as string | null },
          {
            no: 1,
            date: '2025. 12. 02',
            line: '주의문제 T점수 경계선, 외현화 문제는 정상 범위' as
              | string
              | null
          }
        ]
      }
    ]
  }

  type ChartTab = 'counseling' | 'assessment'
  const CHART_TABS = [
    { value: 'counseling', label: '상담' },
    { value: 'assessment', label: '검사' }
  ]
  let chartTab = $state<ChartTab>('counseling')
  const chartGroups = $derived(
    chartTab === 'counseling' ? CHART.counseling : CHART.assessment
  )

  /**
   * 접힘 상태 — **기본은 전부 펼침.** 시안은 둘째 그룹이 접힌 상태를 보여주지만
   * 그건 토글이 있다는 표시이지 초기값이 아니다. 차트는 훑어보는 화면이라
   * 접힌 채로 열리면 "기록이 없는 것"으로 읽힌다.
   */
  let collapsed = $state<Record<string, boolean>>({})
  function toggleGroup(id: string) {
    collapsed = { ...collapsed, [id]: !collapsed[id] }
  }
  let chartOpen = $state(false)
  let pinnedOpen = $state(true)
  /** 공지 오버레이 높이 — 스크롤 영역 상단 여백으로 되먹인다 */
  let pinnedHeight = $state(0)

  /** 맨 위로 가기 — 아래로 내려와 있을 때만 뜬다(맨 위에서는 할 일이 없다) */
  let showToTop = $state(false)
  const TO_TOP_THRESHOLD = 200
  /** 위쪽 끝에 닿기 전에 미리 다음 묶음을 부른다 — 빈 화면을 보는 순간을 없앤다 */
  const LOAD_OLDER_THRESHOLD = 160
  function onStreamScroll() {
    if (!streamEl) return
    showToTop = streamEl.scrollTop > TO_TOP_THRESHOLD
    if (streamEl.scrollTop < LOAD_OLDER_THRESHOLD) void loadOlder()
  }

  /** 위로 이어 붙이기 — 늘어난 높이만큼 되밀어 읽던 자리를 유지한다.
      보정이 없으면 새 묶음이 위에 들어온 만큼 화면이 통째로 아래로 튄다. */
  async function loadOlder() {
    if (!streamEl || !board.hasOlder || board.isLoadingOlder) return
    const el = streamEl
    const prevHeight = el.scrollHeight
    const prevTop = el.scrollTop
    await board.loadOlder()
    await tick()
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - prevHeight + prevTop
    })
  }
  function scrollToTop() {
    streamEl?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  let draft = $state('')
  let streamEl = $state<HTMLDivElement | null>(null)

  /** 채팅과 같이 항상 최신(맨 아래)을 보여준다 */
  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (streamEl) streamEl.scrollTop = streamEl.scrollHeight
    })
  }
  $effect(() => {
    open
    filter
    // 첫 묶음이 도착한 뒤 한 번 더 — 마운트 시점엔 그릴 행이 없어 바닥이 곧 꼭대기다.
    // 필터 교체는 isLoading이 아니라 isPlaceholder가 내려가는 순간이 "도착"이다.
    // 위로 이어 붙일 때는 isLoadingOlder만 움직이므로 여기서 튀지 않는다.
    board.isLoading
    board.isPlaceholder
    scrollToBottom()
  })

  let submitting = $state(false)
  let composerEl = $state<HTMLTextAreaElement | null>(null)

  /** 입력창의 실제 값을 정본(draft)에 다시 맞춘다.
   *  한글 IME 확정 직후 브라우저는 확정 글자를 **compositionend 다음에** input으로
   *  한 번 더 넣는다 — 그게 bind:value를 타고 방금 비운 값을 되살린다. 그 이벤트가
   *  지나간 다음 태스크(setTimeout 0)에 맞춰야 하므로 tick으로는 늦출 수 없다. */
  function syncComposerValue() {
    setTimeout(() => {
      if (composerEl && composerEl.value !== draft) composerEl.value = draft
    }, 0)
  }

  async function submitMemo() {
    const text = draft.trim()
    if (!text || submitting) return
    submitting = true
    // 입력창은 즉시 비운다 — 서비스가 임시 행을 먼저 붙이므로 화면이 비는 구간이 없다.
    // 실패하면 되살려서 다시 보낼 수 있게 한다(친 글을 잃지 않는다)
    draft = ''
    syncComposerValue()
    scrollToBottom()
    try {
      await board.submitMemo(text)
      scrollToBottom()
    } catch (e) {
      draft = text
      syncComposerValue()
      // API 실패는 mutationBuilder가 스낵바를 띄운다. 그 밖의 예외(브라우저 API 부재
      // 등)는 여기서 알린다 — 전에는 통째로 삼켜 "눌러도 아무 일도 안 남"이 됐다.
      if (!(e as any)?.isAxiosError && !(e as any)?.response) {
        console.error('케어보드 메모 전송 실패:', e)
        snackbarStore.error(
          '메모를 등록하지 못했어요. 잠시 후 다시 시도해주세요.'
        )
      }
    } finally {
      submitting = false
    }
  }

  function togglePin(item: StreamItem) {
    void board.setPinned(item.id, !item.pinned)
  }

  /** 행 클릭 → 원본. 원본이 지워졌으면 갈 곳이 없다(§9-2) */
  function openSource(item: StreamItem) {
    const href = sourceHref(item)
    if (href) void goto(href)
  }

  /** 한글 조합 중에 눌린 Enter — 조합 확정(compositionend) 직후에 보낸다 */
  let enterPendingAfterComposition = false

  function onComposerKeydown(e: KeyboardEvent) {
    // Enter = 등록, Shift+Enter = 줄바꿈 (채팅 관례)
    // ⚠️ 한글 IME 조합 중에는 Enter가 `key: 'Enter'`로 오지 않는다 —
    //    Chrome은 조합 확정용 키를 `key: 'Process'` · `keyCode: 229` ·
    //    `isComposing: true`로 올린다. key만 보면 "엔터를 쳐도 아무 일도 안 나는"
    //    상태가 된다(한글로 쓰면 항상 마지막 글자가 조합 중이라 사실상 상시 재현).
    //    물리 키는 `code`가 알려주므로 그걸로 판정한다.
    const isEnter = e.key === 'Enter' || e.code === 'Enter'
    if (!isEnter) {
      enterPendingAfterComposition = false
      return
    }
    if (e.shiftKey) return

    if (e.isComposing || e.keyCode === 229) {
      // 이 Enter는 브라우저가 "조합 확정"으로 먼저 먹는다. 여기서 바로 보내면
      // 확정 전 값이 나가므로 확정 직후로 미룬다. (preventDefault를 걸면
      // 확정 자체가 막히므로 걸지 않는다 — 이때 줄바꿈은 삽입되지 않는다)
      enterPendingAfterComposition = true
      return
    }

    e.preventDefault()
    submitMemo()
  }

  function onComposerCompositionEnd(e: CompositionEvent) {
    if (!enterPendingAfterComposition) return
    enterPendingAfterComposition = false
    // compositionend 시점엔 bind:value가 아직 확정 글자를 못 받았을 수 있어
    // 엘리먼트에서 직접 읽어 채운 뒤 보낸다.
    const el = e.currentTarget as HTMLTextAreaElement | null
    if (el) draft = el.value
    // submitMemo가 draft와 엘리먼트를 함께 비운다(syncComposerValue) — 이 경로에선
    // 브라우저가 확정 글자를 input으로 한 번 더 넣어 값을 되살리기 때문에 필요하다.
    // 없으면 등록은 됐는데 입력창에 글자가 남고, 다시 엔터를 치면 같은 메모가 두 번 올라간다.
    void submitMemo()
  }
</script>

<!-- ─────────── 아이콘 (20 · currentColor) ─────────── -->
{#snippet iconChat()}
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M17 9.5c0 3.59-3.13 6.5-7 6.5-.82 0-1.6-.13-2.33-.37L4 17l.98-2.72C3.75 13.1 3 11.39 3 9.5 3 5.91 6.13 3 10 3s7 2.91 7 6.5Z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

{#snippet iconChart()}
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect
      x="3.5"
      y="3.5"
      width="13"
      height="13"
      rx="2.5"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <path
      d="M6.5 12.5V9M10 12.5V7M13.5 12.5v-2"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  </svg>
{/snippet}

<!-- 섹션 제목은 두 급이다 — 본문(진행중 상담·경과)과 참조(배경·주의사항·검사).
     "무엇이 결론이고 무엇이 근거인가"를 자리(좌/우)만이 아니라 크기로도 말한다. -->
<!-- 기본 정보 3칸의 라벨 — §text-field 라벨 표준(15/500 · title-subtle).
     행 20 고정은 세 칸의 값 첫 줄을 같은 선에서 시작시키기 위한 것이다
     (라벨 line-height가 15라 감싸지 않으면 칸마다 값 시작 높이가 흔들린다). -->
{#snippet basicLabel(text: string)}
  <div class="flex h-5 shrink-0 items-center">
    <Typography variant="body-02-normal-medium" color="text-title-subtitle">
      {text}
    </Typography>
  </div>
{/snippet}

{#snippet basicField(label: string, value: string | null)}
  <!-- 라벨 → 값 8 (§text-field). 값이 없어도 칸을 지우지 않는다 —
       칸이 사라지면 내담자마다 3칸 배치가 달라져 학습된 눈이 안 생긴다 -->
  <div class="flex min-w-0 flex-1 flex-col gap-2">
    {@render basicLabel(label)}
    <Typography
      variant="body-02-reading-regular"
      color={value ? 'text-body-default' : 'text-icon-secondary'}
      tag="p"
    >
      {value ?? '없음'}
    </Typography>
  </div>
{/snippet}

<!-- 공지에 올라간 한 줄 — **스트림 행과 같은 형식으로 그린다.**
     본문 텍스트만 뽑아 평문으로 찍으면 종류·제목·회차가 전부 사라져
     "무엇을 고정한 것인지" 읽을 수 없다(메모는 본문이 곧 전부라 그대로 둔다).
     아이콘은 항상 첫 줄에 고정 — items-center면 본문이 여러 줄로 펼쳐질 때
     압정이 세로 가운데로 내려가 위치가 흔들린다. -->
{#snippet pinnedRow(p: StreamItem, clamp: boolean)}
  <div class="flex items-start gap-2.5">
    <span class="shrink-0"><PinIcon24 /></span>
    {#if p.author}
      <Typography
        variant="body-01-reading-regular"
        color="text-body-default"
        className="min-w-0 flex-1 {clamp ? 'line-clamp-1' : ''}"
      >
        {p.body}
      </Typography>
    {:else}
      <button
        type="button"
        disabled={sourceHref(p) === null}
        onclick={() => openSource(p)}
        class="flex min-w-0 flex-1 flex-col gap-1 text-left disabled:cursor-default"
      >
        <span class="flex w-full min-w-0 items-center gap-2">
          <BadgeRectangle
            label={KIND_META[p.kind].label}
            color={KIND_META[p.kind].color}
            size="sm"
          />
          <Typography
            variant="body-02-normal-medium"
            color="text-body-strong"
            className="min-w-0 truncate-safe">{p.title}</Typography
          >
          {#if p.subtitle}
            <Typography
              variant="body-03-normal-medium"
              color="text-title-subtitle"
              className="whitespace-nowrap">{p.subtitle}</Typography
            >
          {/if}
        </span>
        {#if p.body}
          <Typography
            variant="body-01-reading-regular"
            color="text-body-default"
            className="w-full min-w-0 {clamp ? 'line-clamp-1' : ''}"
            >{p.body}</Typography
          >
        {/if}
      </button>
    {/if}
  </div>
{/snippet}

<!-- 원본이 지워진 행 — 행은 남기고(§9-2) 왜 안 눌리는지 자리로 말한다 -->
{#snippet deletedMark(item: StreamItem)}
  {#if item.sourceDeleted}
    <Typography
      variant="body-03-normal-regular"
      color="text-icon-secondary"
      className="whitespace-nowrap">원본 삭제됨</Typography
    >
  {/if}
{/snippet}

{#snippet emptySlot(text: string)}
  <div class="mt-4 flex h-20 items-center justify-center rounded-xl bg-bg-base">
    <Typography variant="body-02-normal-regular" color="text-icon-secondary">
      {text}
    </Typography>
  </div>
{/snippet}

<!-- ─────────── 진입 버튼 ───────────
     인셋 56/56 — 콘텐츠 끝선(우 80 · 하 32)에 일부러 맞추지 않는다.
     끝선에 정확히 맞추면 컨테이너에 걸쳐 놓은 요소처럼 읽혀 "떠 있음"이 사라진다. -->
{#if !open}
  <!-- 닫힘 상태에서도 **열었을 때와 같은 워드마크**를 보여준다 — 아이콘+텍스트를
       따로 조합하면 같은 기능이 두 얼굴을 갖는다.
       면이 흰색인 이유는 로고가 그라디언트(#56C0F8→#4846F4) 워드마크라서다.
       유채색 면 위에 얹으면 그라디언트가 죽고 대비도 무너진다 — 색은 로고가 지고,
       버튼은 흰 면 + 보더 + 그림자로 "떠 있음"만 말한다(§button-white 계열). -->
  <button
    transition:fade={{ duration: 120 }}
    type="button"
    aria-label="케어보드 열기"
    onclick={() => (open = true)}
    class="fixed right-14 bottom-14 z-40 flex h-12 items-center rounded-full border border-border-default bg-white px-5 shadow-dropdown transition-colors hover:bg-gray-50"
  >
    <CareBoardLogo />
    {#if newCount > 0}
      <!-- 새 기록 수는 버튼 모서리에 **걸친다** — 안에 두면 워드마크와 한 줄로
           읽혀 로고의 일부처럼 보이고, 완전히 빼면 버튼과 떨어진 별개 요소가 된다.
           4px만 밖으로 내 절반 이상이 버튼 위에 앉게 한다. -->
      <span
        class="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5"
      >
        <Typography variant="label-02-normal-medium" color="text-white">
          {newCount}
        </Typography>
      </span>
    {/if}
  </button>
{/if}

<!-- ─────────── 도크 (열릴 때만 · 화면 우측에 딱 붙음) ───────────
     같은 층에서 폭을 나눠 갖는 도크라 그림자를 쓰지 않는다 — 그림자는 "떠 있음"의 신호다 -->
{#if open}
  <section
    transition:fly={{ x: 400, duration: 220 }}
    class="fixed top-16 right-0 bottom-0 z-40 flex w-[400px] flex-col border-l border-border-default bg-white"
  >
    <!-- 가장자리 토글 — 좌측 GNB의 접기 버튼과 같은 규격(원 20 · 보더 gray-200 ·
         shadow-md · 셰브런 14)을 그대로 쓰고, 붙는 변과 화살표 방향만 반대다.
         GNB는 우측 가장자리에서 왼쪽 화살표, 케어보드는 좌측 가장자리에서 오른쪽 화살표. -->
    <button
      type="button"
      title="케어보드 접기"
      aria-label="케어보드 접기"
      onclick={() => (open = false)}
      class="absolute top-1/2 -left-3 z-50 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-border-default bg-white text-icon-secondary shadow-md transition-all hover:bg-bg-base hover:text-body-default"
    >
      <svg
        class="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>

    <!-- 패널 헤더 — 높이 62 고정 (§Components>panel-header) -->
    <header
      class="flex h-[62px] shrink-0 items-center justify-between border-b border-border-default bg-white px-5"
    >
      <!-- 타이틀은 워드마크(Figma CardBoardLogo 88×24). 이름은 그대로 옆에 둔다 -->
      <div class="flex min-w-0 items-center gap-2">
        <span class="shrink-0"><CareBoardLogo /></span>
        <Typography
          variant="body-03-normal-regular"
          color="text-body-subtle"
          className="truncate-safe">{clientName}</Typography
        >
      </div>
      <!-- 차트로 가는 문. 타임라인 행(→ 그 사건의 원본)과 목적지가 다르므로
           스트림 안이 아니라 헤더에 둬서 "보드 전체에 대한 액션"임을 자리로 말한다 -->
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onclick={() => (chartOpen = true)}
          class="flex h-8 items-center gap-1 rounded-lg border border-border-default bg-white pr-3 pl-2 transition-colors hover:bg-bg-base"
        >
          <span class="text-body-subtle">{@render iconChart()}</span>
          <Typography variant="body-03-normal-medium" color="text-body-default"
            >차트</Typography
          >
        </button>
      </div>
    </header>

    <!-- 종류 필터 — Round_Tab (Figma 10899:182927 / 컴포넌트 2106:92867).
         칩 h36(py10) · w62 · radius pill · 칩 간격 8(Figma 4에서 상향)
         좌우 패딩만 Figma(16) 대신 **20** — 도크 안 다른 블록(스트림·고정 메모·입력창)이
         전부 px-5라, 16을 그대로 쓰면 칩 왼쪽 끝이 아래 콘텐츠보다 4px 안쪽으로 들어와
         정렬축이 어긋난다. 원 프레임은 단독으로 그려져 도크 패딩을 반영하지 않은 값.
         선택 = gray-700 면 + gray-50 글자 / 미선택 = 흰 면 + gray-200 보더 + gray-500 글자
         텍스트는 Body_02/Normal-Medium(15) — Figma 16에서 한 단계 다운(좁은 도크라
         칩이 다섯 개 나열되는 자리라서).
         배경은 투명 — 아래 스트림과 같은 면으로 이어져 채팅 영역과 갈리지 않는다.
         (Figma 원본은 선택 칩만 15px이라 미선택(16)과 높이가 1px 어긋난다 — 15로
          통일하고 높이를 36으로 고정했다.) -->
    <div class="flex shrink-0 items-center gap-2 px-5 pt-3 pb-4">
      {#each FILTERS as f}
        {@const on = filter === f.value}
        <button
          type="button"
          onclick={() => (filter = f.value)}
          class="flex h-9 w-[62px] shrink-0 items-center justify-center rounded-full transition-colors {on
            ? 'bg-gray-700'
            : 'border border-border-default bg-white hover:bg-bg-base'}"
        >
          <Typography
            variant="body-02-normal-medium"
            color={on ? 'text-gray-50' : 'text-body-subtle'}
          >
            {f.label}
          </Typography>
        </button>
      {/each}
    </div>

    <!-- 스트림 (Figma 10901:183078) — 위=오래된, 아래=최신 (채팅 관례)
         한 묶음 = **호버되는 박스 하나** (담당자 또는 타이틀 + 본문 + 시각).
         묶음끼리 16 · 날짜 구분선 ↔ 묶음 16 — 스택의 모든 사이 간격이 16이다.
         묶음을 가르는 건 간격이 아니라 호버 면과 안쪽 간격(12/8)의 대비다.
         묶음 **안쪽**은 12(헤더→본문) · 8(본문→시각).
         컨테이너 상 12 / 하 20 · 좌우는 도크 규격 20 -->
    <div class="relative flex min-h-0 flex-1 flex-col">
      <!-- 고정 메모 (Figma 10899:182930) — 반투명 흰 면 + blur · r12 · p12 · gap10
         압정 24(유채색) / 본문 Body_01 Reading(16) text/body-default / 우측 셰브런 20.
         셰브런은 **접기·펼치기 전용**이다 — 여기서 고정을 해제해버리면 되돌릴 수단이
         없다(해제는 스트림 메모 행의 핀 버튼이 소유). 접으면 첫 건 한 줄로 축약된다. -->
      {#if pinned.length > 0}
        <!-- 공지는 스트림과 **다른 레이어**다 — 흐름 안에 두면 메시지가 그 아래에서
             잘리는 것처럼 보인다. 위에 띄우고, 반투명 흰 면 + backdrop-blur로
             뒤로 지나가는 메시지가 흐릿하게 비치게 한다.
             면은 primary-100/50 · blur 16 — 흰 바디 위에서 회색은 그림자처럼 읽혀
             브랜드 틴트로 바꿨다. 보더 없이 면과 blur만으로 레이어를 세운다.
             두 값은 맞물린다: 면이 투명할수록 뒤 메시지가 비쳐 글자가 흐려지므로
             blur를 그만큼 올려 뒤를 더 뭉갠다(70/12 → 60/16 → 50/16). -->
        <!-- 최대 높이 = 스트림 영역의 40%. 핀이 늘어도 공지가 보드를 잠식하지 않게
             천장을 두고, 넘치는 만큼은 공지 **안에서만** 스크롤한다(도크 높이에
             비례하므로 짧은 화면에서도 메시지 자리가 60% 남는다). -->
        <div
          bind:clientHeight={pinnedHeight}
          class="pointer-events-none absolute inset-x-0 top-0 z-10 flex max-h-[40%] flex-col px-5 pb-3"
        >
          <div
            class="pointer-events-auto flex min-h-0 gap-2.5 rounded-xl bg-primary-100/50 p-3 backdrop-blur-[16px]"
          >
            <!-- 목록 — 천장에 닿으면 여기서만 스크롤. overscroll-contain으로
                 끝까지 굴려도 뒤 스트림으로 스크롤이 넘어가지 않는다. -->
            <div
              class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain"
            >
              {@render pinnedRow(pinned[0], !pinnedOpen)}

              {#if pinnedOpen && pinned.length > 1}
                <ul
                  transition:slide={{ duration: 140 }}
                  class="flex flex-col gap-3"
                >
                  {#each pinned.slice(1) as p (p.id)}
                    <li>{@render pinnedRow(p, false)}</li>
                  {/each}
                </ul>
              {/if}
            </div>

            <!-- 접기·펼치기 — 목록 전체를 여닫는 버튼이라 스크롤 밖(패널 소유)에 둔다.
                 스크롤 안에 두면 아래로 굴렸을 때 접을 방법이 사라진다.
                 셰브런(20)만 첫 줄 높이(24) 박스에 담아 압정(24)과 밑선을 맞춘다. -->
            <button
              type="button"
              aria-label={pinnedOpen ? '고정 메모 접기' : '고정 메모 펼치기'}
              aria-expanded={pinnedOpen}
              onclick={() => (pinnedOpen = !pinnedOpen)}
              class="flex h-6 shrink-0 items-center text-icon-secondary transition-transform hover:text-body-default {pinnedOpen
                ? 'rotate-180'
                : ''}"
            >
              <ChevronDownIcon20 />
            </button>
          </div>
        </div>
      {/if}

      <!-- 스크롤 영역 — 위쪽은 공지 높이만큼 비워 첫 메시지가 가려지지 않게 한다.
           위아래 40씩 그라디언트 마스크: 위는 탭·공지 밑으로, 아래는 입력창 앞으로
           메시지가 자연스럽게 사라진다(양끝의 딱딱한 잘림 제거). -->
      <div
        bind:this={streamEl}
        onscroll={onStreamScroll}
        class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-5 transition-opacity duration-200 {board.isPlaceholder
          ? 'opacity-40'
          : 'opacity-100'}"
        style="padding-top: {pinnedHeight +
          12}px; mask-image: linear-gradient(to bottom, transparent 0, #000 40px, #000 calc(100% - 40px), transparent 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 40px, #000 calc(100% - 40px), transparent 100%);"
      >
        {#if board.isLoadingOlder}
          <!-- 이전 기록을 불러오는 중 — 위에 더 있다는 신호가 이 자리에 있어야
               사용자가 처음까지 다 봤다고 오해하지 않는다 -->
          <div class="flex shrink-0 items-center justify-center py-2">
            <Typography
              variant="body-03-normal-regular"
              color="text-placeholder"
            >
              이전 기록 불러오는 중…
            </Typography>
          </div>
        {/if}

        <!-- 비었다는 말은 **다 받아온 뒤에만** — 불러오는 동안 띄우면
             필터를 처음 여는 순간 "기록이 없다"가 깜빡였다가 목록이 들어찬다 -->
        {#if stream.length === 0 && !board.isLoading}
          <div class="flex h-full items-center justify-center">
            <Typography
              variant="body-02-normal-regular"
              color="text-placeholder"
            >
              아직 등록된 기록이 없어요.
            </Typography>
          </div>
        {/if}

        {#each groups as group (group.key)}
          <!-- 날짜 구분자 — 선 12 텍스트 12 선. Body_03(14) text/label-default -->
          <div in:fade={{ duration: 160 }} class="flex items-center gap-3">
            <div class="h-px flex-1 bg-border-default"></div>
            <Typography
              variant="body-03-normal-regular"
              color="text-title-subtitle"
              className="whitespace-nowrap"
            >
              {group.label}
            </Typography>
            <div class="h-px flex-1 bg-border-default"></div>
          </div>

          <ul class="flex flex-col gap-4">
            {#each group.rows as item (item.key)}
              {@const meta = KIND_META[item.kind]}
              <!-- 우측 슬롯은 **고정 전용**이다 — 한 자리에 `>`(이동)와 핀(고정)을
                 번갈아 넣으면 두 뜻이 겹쳐 무엇을 누르는 자리인지 모른다.
                 이동은 행 본문 전체가 이미 링크이고, 열리는 행인지는 호버 면으로 말한다.
                 행 본문과 슬롯은 형제 버튼이라 중첩되지 않는다.
                 고정된 행은 **면으로 먼저 읽힌다** — 20짜리 핀 아이콘 하나는 훑어
                 내릴 때 안 걸린다. 면은 공지 카드(primary-100/50)보다 한 단계 옅은
                 primary-50 + primary-200 인셋 링 — 같은 색 가족으로 "저 위 공지에
                 올라간 것"임을 말하되, 카드보다 약해야 위계가 뒤집히지 않는다. -->
              <!-- 등장 전환은 **들어올 때만**(in:) — 나갈 때도 걸면 사라지는 동안
                   행이 DOM에 남아 스크롤 높이가 흔들리고, 위로 이어 붙일 때의
                   위치 보정(loadOlder)이 어긋난다. 이동이 아니라 투명도+6px라
                   레이아웃을 건드리지 않는다. -->
              <li
                in:fly={{ y: 6, duration: 180, easing: cubicOut }}
                class="group/row relative -mx-3 flex flex-col gap-3 rounded-xl px-3 py-2 transition-colors {item.pinned
                  ? 'bg-primary-50 ring-1 ring-primary-200 ring-inset'
                  : sourceHref(item)
                    ? 'hover:bg-bg-base'
                    : ''}"
              >
                {#if item.author}
                  <!-- ① 사람이 쓴 메모 — 아바타 24 + 이름 16 SemiBold + 역할 14.
                     **본문이 아바타 아래로 들어간다**(pl-8 = 아바타 24 + gap 8) —
                     채팅에서 말이 말한 사람 밑으로 붙는 관습 그대로다. 시스템 기록은
                     좌측 끝에 붙으므로, 정렬선 하나만으로 두 종류가 갈린다. -->
                  <div class="flex items-center gap-2 pr-7">
                    <MemberAvatar name={item.author} sizeClass="h-6 w-6" />
                    <div class="flex min-w-0 items-baseline gap-2">
                      <Typography
                        variant="body-01-normal-semibold"
                        color="text-body-strong"
                        className="truncate-safe">{item.author}</Typography
                      >
                      <Typography
                        variant="body-03-normal-regular"
                        color="text-body-default"
                        className="whitespace-nowrap">담당자</Typography
                      >
                      {@render deletedMark(item)}
                    </div>
                  </div>
                  <div
                    class="flex flex-col gap-2 pl-8 {item.sourceDeleted
                      ? 'opacity-60'
                      : ''}"
                  >
                    <Typography
                      variant="body-01-reading-regular"
                      color="text-body-default">{item.body}</Typography
                    >
                    <Typography
                      variant="body-03-reading-regular"
                      color="text-body-subtle"
                      >{timeLabel(item.time)}</Typography
                    >
                  </div>
                {:else}
                  <!-- ② 시스템이 남긴 기록 — 배지 + 제목 15 Medium + 부제 14.
                     본문 전체가 원본으로 가는 링크다(메모는 갈 곳이 없어 링크가 아니다).
                     제목을 메모 이름(16 SemiBold)보다 한 단 낮춘다 — 스트림에서
                     **가장 큰 글자는 사람 이름뿐**이라는 규칙이 서면, 훑어 내릴 때
                     "누가 말한 것"과 "무슨 일이 있었던 것"이 굵기로 먼저 갈린다. -->
                  <button
                    type="button"
                    disabled={sourceHref(item) === null}
                    onclick={() => openSource(item)}
                    class="flex w-full flex-col gap-3 text-left disabled:cursor-default {item.sourceDeleted
                      ? 'opacity-60'
                      : ''}"
                  >
                    <span class="flex w-full min-w-0 items-center gap-2 pr-7">
                      <BadgeRectangle
                        label={meta.label}
                        color={meta.color}
                        size="sm"
                      />
                      <span class="flex min-w-0 items-baseline gap-2">
                        <Typography
                          variant="body-02-normal-medium"
                          color="text-body-strong"
                          className="min-w-0 truncate-safe"
                          >{item.title}</Typography
                        >
                        {#if item.subtitle}
                          <Typography
                            variant="body-03-normal-medium"
                            color="text-title-subtitle"
                            className="whitespace-nowrap"
                            >{item.subtitle}</Typography
                          >
                        {/if}
                        {@render deletedMark(item)}
                      </span>
                    </span>

                    <span class="flex w-full flex-col gap-2">
                      {#if item.body}
                        <Typography
                          variant="body-01-reading-regular"
                          color="text-body-default">{item.body}</Typography
                        >
                      {/if}
                      <!-- 담당자·장소 — 인라인 구분선으로 잇는다. 시각보다 한 단계 큰 15 -->
                      <span class="flex min-w-0 items-center gap-2">
                        {#each (item.meta ?? '').split(' · ') as part, i}
                          {#if i > 0}
                            <span
                              class="h-[11px] w-px shrink-0 bg-border-default"
                            ></span>
                          {/if}
                          <Typography
                            variant="body-02-reading-regular"
                            color="text-body-subtle"
                            className="whitespace-nowrap">{part}</Typography
                          >
                        {/each}
                      </span>
                      <!-- 작성 시각은 종류와 무관하게 **항상 묶음의 좌측 하단** —
                         메모 행과 같은 자리라야 스트림을 훑을 때 시각이 한 열로 읽힌다 -->
                      <Typography
                        variant="body-03-reading-regular"
                        color="text-body-subtle"
                        className="whitespace-nowrap"
                        >{timeLabel(item.time)}</Typography
                      >
                    </span>
                  </button>
                {/if}

                <!-- 우측 슬롯: 기본 `>` → 호버 시 핀. 고정된 항목은 핀이 계속 켜져 있다 -->
                <button
                  type="button"
                  aria-label={item.pinned ? '고정 해제' : '공지로 고정'}
                  aria-pressed={item.pinned}
                  onclick={() => togglePin(item)}
                  class="absolute top-2 right-3 flex h-5 w-5 items-center justify-center"
                >
                  <!-- 공지 카드와 **같은 압정**이다 — 형태·방향이 다르면 "저 위에
                       올라간 그것"이라는 연결이 끊긴다. 크기만 20으로 줄인다.
                       미고정은 그레이톤으로 뺀다(전송 버튼과 같은 규율) — 색이
                       곧 "지금 고정돼 있나"의 답이라 밝기만으로 가르지 않는다. -->
                  {#if item.pinned}
                    <PinIcon24 size={20} />
                  {:else}
                    <span
                      class="hidden opacity-60 grayscale transition-all group-hover/row:flex hover:opacity-100 hover:grayscale-0"
                    >
                      <PinIcon24 size={20} />
                    </span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/each}
      </div>

      <!-- 맨 위로 — 스크롤 영역 위에 떠 있다(마스크가 걸린 스크롤러 바깥이라 흐려지지 않는다).
           입력창 바로 위 **가로 가운데**(입력창이 좌우 20 패딩으로 꽉 차 있어
           도크 중앙 = 입력창 중앙), 아래로 내려와 있을 때만 나타난다 -->
      {#if showToTop}
        <button
          transition:fade={{ duration: 120 }}
          type="button"
          aria-label="맨 위로"
          onclick={scrollToTop}
          class="absolute bottom-2 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-border-default bg-white text-body-subtle shadow-card transition-colors hover:bg-bg-base hover:text-body-default"
        >
          <span class="rotate-180"><ChevronDownIcon20 /></span>
        </button>
      {/if}
    </div>

    <!-- 입력창 (Figma Textarea 10901:183079) — r12 · border input/border
         placeholder Body_01(16) text/placeholder · 좌우 12
         높이·상하 패딩은 현재 구현 기준(도크 세로가 유한해 116 고정은 과하다) -->
    <!-- 하단 여백은 도크 좌우(20)가 아니라 **페이지 셸 하단 패딩(32)**에 맞춘다 —
         도크는 화면 맨 아래까지 내려오므로 20으로 두면 입력창 밑선이 좌측 카드
         밑선보다 12 아래로 내려가 두 컬럼의 바닥이 어긋난다 -->
    <div class="shrink-0 px-5 pb-8">
      <div class="rounded-xl bg-bg-base px-3 py-3">
        <textarea
          bind:this={composerEl}
          bind:value={draft}
          onkeydown={onComposerKeydown}
          oncompositionend={onComposerCompositionEnd}
          rows="2"
          placeholder="공유할 메모를 남겨보세요"
          class="w-full resize-none border-0 bg-transparent text-body-01-normal-regular text-body-strong outline-none placeholder:text-placeholder"
        ></textarea>
        <div class="mt-2 flex items-center justify-end gap-2">
          <!-- 전송 — Figma 정본 아이콘(node 11039:132883 · Icon_24)을 원형 영역(36) 안에 담는다.
               활성: primary-500 면 + **흰색·하늘색 2톤** 아이콘. 원본 4톤(파랑 계열)은
               파란 면 위에서 묻히므로 본체를 흰색으로 올리고 접힌 면·꼬리만
               하늘색(primary-200/300)으로 남겨 종이비행기의 접힘이 살아 있게 한다.
               비활성: **그레이톤으로 통째로 뺀다** — 면 gray-100 + 아이콘 grayscale.
               파란 계열로 눌러 앉히면 활성과 색 가족이 같아 "지금 누를 수 있나"가
               밝기 차이로만 갈려 약하다. 색을 아예 빼는 쪽이 확실하다. -->
          <button
            type="button"
            onclick={submitMemo}
            disabled={!draft.trim()}
            aria-label="메모 등록"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed {draft.trim()
              ? 'bg-primary-500 hover:bg-primary-600'
              : 'bg-gray-100'}"
          >
            <!-- 종이비행기는 **기하 중심이 맞아도 광학 중심이 안 맞는다** —
                 잉크 실측: bbox 중심은 (12.00, 11.93)으로 프레임 중앙과 같지만
                 면적 무게중심은 (14.03, 11.91)로 **오른쪽 2px**에 있다(두꺼운 본체·
                 접힌 면이 오른쪽 절반, 얇은 기수만 좌하단으로 뻗는다). 그래서 bbox대로
                 놓으면 원 안에서 오른쪽으로 쏠려 보인다. 무게중심 보정분(2px)의 절반인
                 1px만 왼쪽으로 민다 — 전부 밀면 이번엔 기수 끝이 원 왼쪽에 붙는다.
                 세로는 무게중심 편차가 0.09px라 보정하지 않는다.
                 간격이 아니라 광학 보정이라 4px 그리드 대상이 아니다. -->
            <span
              class="-translate-x-px {draft.trim()
                ? ''
                : 'opacity-60 grayscale'}"
              aria-hidden="true"
            >
              {#if draft.trim()}
                <SendIcon24
                  body="var(--color-white)"
                  fold="var(--color-primary-200)"
                  tail="var(--color-primary-300)"
                />
              {:else}
                <SendIcon24 />
              {/if}
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
{/if}

<!-- ─────────── 차트 (헤더 `차트` 버튼 → 여기) ───────────
     시안: Figma "SaaS V.2 통합" node 10968:29078

     ── 골격: 위에서 아래로 네 덩어리 ──
       헤더(고정) 아바타 40 + 이름 + 생년|성별 + 닫기
       ② 기본 정보  가족관계 | 주호소 문제 | 진행중인 치료 — 세로 괘선 3칸
       ③ AI 요약    ②④를 바탕으로 한 **사실 요약** (판단·소견 아님)
       ④ 상담 | 검사 탭으로 가르고, 그룹 안에 한 회기 한 줄

     ── 시안 대비 MD를 우선한 곳 (규격 정본 = apps/web/Web_Design.md) ──
       · 헤더 패딩 24/16/20 → **좌우 20 · 상하 16**(§modal Header)
       · 헤더 타이틀 18/600 → **L 20/600**(§Title system — 모달 타이틀은 L 고정)
       · 부제 색 body-default → **body-subtle**(§modal 2줄 헤더)
       · 본문 패딩 px 24 · pb 30 → **사방 20 · 하단만 40**(§modal, footer 없는 조회 전용)
       · 블록 간격 20 → **24**(§Spacing ② 그룹 간 구분)
       · 탭 라벨 18/600 → **16/500 Medium**, 비활성 gray-400, 트랙 border-default
         (§tab — 굵기는 Medium 고정이고 활성/비활성은 색으로만 가른다). 공용
         `TabBar`가 이 규격의 단일 소스라 페이지에서 재정의하지 않는다.
       · AI 카드 내부 gap 8 → **12**, 타이틀 색 title-subtle → **ai-500**,
         본문 gray-800 → **gray-900**, 보더 #A56EFF → **border-ai-500**
         (§Colors>AI 그라디언트 — 요약 카드는 `bg-ai-50` + `border-ai-500`이 정본) -->
{#if chartOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
    onclick={() => (chartOpen = false)}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- 높이는 **최댓값에 고정**한다(max-h가 아니라 h) — 내용량에 따라 패널이
         늘었다 줄었다 하면 "어떤 내담자를 열어도 같은 자리에서 읽는다"는 차트의
         전제가 깨진다. 940 = §modal 최대 높이. -->
    <section
      class="flex h-[min(90vh,940px)] w-[min(94vw,740px)] flex-col overflow-hidden rounded-[20px] bg-white shadow-floating"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- ══ 헤더 — 신원만 (§modal: 좌우 20 · 상하 16) ══ -->
      <header
        class="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5 py-4"
      >
        <div class="flex min-w-0 items-center gap-3">
          <ClientAvatar
            profileImageUrl={clientProfileImageUrl}
            name={clientName}
            gender={clientGender}
            sizeClass="h-10 w-10"
            textClass="text-[16px]"
          />
          <div class="flex min-w-0 flex-col gap-2">
            <!-- 모달 타이틀 = L(20/600) 고정 (§Title system) -->
            <Typography
              variant="headline-02-normal-semibold"
              color="text-body-strong">{clientName}</Typography
            >
            <!-- 생년월일|성별은 공용 규격 하나로만 — 시크릿 모드 마스킹까지 내부 처리 -->
            <ClientBirthGender
              birthDate={clientBirthDate}
              gender={clientGender}
              color="text-body-subtle"
            />
          </div>
        </div>
        <!-- 닫기 = 전 모달 공통 규격(BaseModal과 같은 마크업) — CloseIcon32,
             래퍼 박스·hover 배경 없음. §modal은 "닫기 아이콘 32"를 헤더 높이를
             정하는 값으로 못박으므로 여기만 20으로 줄이면 규격이 갈린다. -->
        <button
          type="button"
          aria-label="닫기"
          onclick={() => (chartOpen = false)}
          class="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
        >
          <CloseIcon32 />
        </button>
      </header>

      <!-- 본문 — footer 없는 조회 전용이라 하단만 40 (§modal) -->
      <div class="min-h-0 flex-1 overflow-y-auto p-5 pb-10">
        <!-- ══ ② 기본 정보 — 주호소 문제 | 진행중인 치료 ══
             가족관계는 뺐다 — 폭 740에 세 칸을 두면 칸당 200px라 가장 긴 주호소가
             4줄로 접혔다. 두 칸이면 칸당 약 330px로 주호소가 2줄에 들어간다.
             (가족관계는 내담자 상세가 정본이라 차트에서 빠져도 갈 곳이 있다.)

             정렬이 둘로 갈린다 — **칸은 늘어나고(stretch), 괘선만 가운데 선다**.
             items-center로 두면 값 줄 수가 칸마다 달라 두 라벨이 서로 다른 높이에서
             시작한다(라벨은 같은 선에 있어야 한 표로 읽힌다). stretch면 라벨이
             둘 다 행 상단에서 시작하고, 괘선은 self-center로 빼 높이 60 고정을
             행 중앙에 유지한다. -->
        <div class="flex items-stretch gap-6">
          {@render basicField('주호소 문제', CHART.basics.chiefComplaint)}
          <span class="h-[60px] w-px shrink-0 self-center bg-border-default"
          ></span>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            {@render basicLabel('진행중인 치료')}
            {#if CHART.counseling.length > 0}
              <ul class="flex flex-col gap-2">
                {#each CHART.counseling as c (c.id)}
                  <li>
                    <!-- 치료명은 센터가 지은 이름 그대로 (배지로 감싸지 않는다) -->
                    <Typography
                      variant="body-02-reading-regular"
                      color="text-body-default"
                      tag="p">{c.name} ({c.done}/{c.total}회기)</Typography
                    >
                  </li>
                {/each}
              </ul>
            {:else}
              <Typography
                variant="body-02-reading-regular"
                color="text-icon-secondary">없음</Typography
              >
            {/if}
          </div>
        </div>

        <!-- ══ ③ AI 요약 ══
             외곽선 = **AI 그라디언트 1px**(`.border-ai-gradient`) — §Colors>AI가
             "AI 결과 카드 외곽"으로 지정한 유틸이고, 시안의 보더색 #A56EFF도
             이 그라디언트의 첫 스톱(`--gradient-ai-from`)이다. 단색 ai-500으로
             굳히면 스톱 셋(보라→보라파랑→파랑)이 사라진다.
             안쪽 면은 `--ai-gradient-surface`를 ai-50으로 바꿔 틴트를 유지한다
             (유틸이 면을 padding-box로, 그라디언트를 border-box로 칠한다).
             면(.bg-ai-gradient)은 쓰지 않는다 — 안쪽은 ai-50 단색 틴트다.
             ⚠️ 라인과 글자에 그라디언트를 함께 쓴 건 §Colors의 "솔리드·글자·라인
             중 한 화면에 하나만"에서 벗어난 선택이다(사용자 지시).

             **하단 고지는 장식이 아니다** — 이 카드가 무엇을 하고 무엇을 안 하는지의
             선언이고, 없으면 요약이 소견처럼 읽힌다. (시안에는 없는 한 줄) -->
        <section
          class="border-ai-gradient mt-5 rounded-2xl p-4"
          style="--ai-gradient-surface: var(--color-ai-50)"
        >
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <AiStarIcon20 />
              <!-- 타이틀도 그라디언트(`.text-ai-gradient`) — 아이콘·테두리와
                   같은 램프를 탄다. Typography의 color prop은 텍스트 색을 직접
                   칠해 background-clip:text를 덮으므로 색은 넘기지 않고
                   className으로 유틸만 얹는다. -->
              <Typography
                variant="body-02-normal-medium"
                color=""
                className="text-ai-gradient truncate-safe"
                >{clientName}의 {CHART.aiSummary.period} 요약</Typography
              >
            </div>
            <!-- 여러 줄 본문은 반드시 reading(150%) — §Typography 사용 역할 -->
            <Typography
              variant="body-01-reading-regular"
              color="text-title-default"
              tag="p">{CHART.aiSummary.text}</Typography
            >
            <div class="flex items-start gap-2">
              <!-- 아이콘 16은 에셋 네이티브 크기 그대로. mt-0.5(2)는 간격이 아니라
                   첫 줄(14/150%) 세로 중앙에 맞추는 광학 보정이다 -->
              <span class="mt-0.5 shrink-0"><GrayCircleInfoIcon16 /></span>
              <Typography
                variant="body-03-reading-regular"
                color="text-body-subtle"
                tag="p"
                >상담 기록과 검사 실시 내역을 요약한 것으로, 임상적 판단이나
                소견이 아닙니다.</Typography
              >
            </div>
          </div>
        </section>

        <!-- ══ ④ 상담 | 검사 ══
             공용 TabBar가 §tab 규격의 단일 소스다(16/500 · 활성 primary-500 +
             하단 2px · 비활성 gray-400 · 트랙 border-default). 탭 ↔ 콘텐츠 12. -->
        <TabBar
          class="mt-2"
          tabs={CHART_TABS}
          activeTab={chartTab}
          onTabChange={(t) => (chartTab = t as ChartTab)}
        />

        {#if chartGroups.length > 0}
          <!-- 그룹이 둘 이상이면 사이에 구분선을 둔다 — 여백만으로는 어디까지가
               한 치료의 기록인지 갈리지 않는다(회기 행 간격 12와 그룹 간격 24는
               2배 차이지만, 행이 많아지면 그 대비가 눈에 안 들어온다).
               선 위아래 24 (§Spacing ② 그룹 간 구분) — divide-y가 첫 그룹만
               건너뛰므로 첫 상단·마지막 하단 패딩만 걷어낸다. -->
          <div class="mt-5 flex flex-col divide-y divide-border-subtle">
            {#each chartGroups as g (g.id)}
              <div class="flex flex-col py-6 first:pt-0 last:pb-0">
                <!-- 그룹 제목 = 16/600. 행 24 · 아래 16 (§Title system) -->
                <button
                  type="button"
                  onclick={() => toggleGroup(g.id)}
                  aria-expanded={!collapsed[g.id]}
                  class="flex h-6 w-full items-center justify-between gap-2"
                >
                  <Typography
                    variant="body-01-normal-semibold"
                    color="text-title-default"
                    className="min-w-0 truncate">{g.name}</Typography
                  >
                  <!-- 펼침 v ↔ 접힘 ^ — 180° 한 쌍이라 회전 중에도 화살표가
                       옆으로 눕지 않는다(-90°는 접히는 도중 >가 스쳐 지나간다) -->
                  <span
                    class="shrink-0 text-icon-primary transition-transform duration-200 {collapsed[
                      g.id
                    ]
                      ? 'rotate-180'
                      : ''}"
                  >
                    <ArrowDownIcon24 />
                  </span>
                </button>

                {#if !collapsed[g.id]}
                  <!-- 격자는 **ul이 소유**한다 — 행마다 grid를 걸면 `auto` 열이
                       그 행의 내용 폭으로 각각 잡혀 날짜·요약 좌측이 어긋난다.
                       li는 `contents`로 격자에서 빠진다. 회차 배지 폭이
                       "1회기"와 "10회기"에서 달라지므로 정렬이 필요하다. -->
                  <!-- 접힘/펼침은 높이가 자라고 줄어드는 drawer 동작이다.
                       slide는 height와 padding을 함께 물리므로 mt를 리스트에 두면
                       열릴 때 여백이 먼저 튄다 — 래퍼가 pt로 갖는다.
                       cubicOut = 시작은 빠르고 끝에서 감속(열리는 서랍의 감각). -->
                  <div transition:slide={{ duration: 220, easing: cubicOut }}>
                    <ul
                      class="grid grid-cols-[auto_auto_1fr] items-center gap-y-3 pt-4"
                    >
                      {#each g.rows as r (r.no)}
                        <li class="contents">
                          <!-- 배지 자리에는 우리가 정의한 닫힌 값(회차)만 온다.
                             **단위는 탭마다 다르다** — 같은 자리에 다른 집합이
                             들어오는 곳은 단위로 구분한다(§Do's and Don'ts
                             수량 단위 표기): 상담은 회기, 검사는 회차. -->
                          <BadgeRectangle
                            label={`${r.no}${chartTab === 'counseling' ? '회기' : '회차'}`}
                            color="gray"
                            class="mr-2"
                          />
                          <!-- 날짜 = 보조 값 (§table 셀 텍스트: Body_02/Regular ·
                               body-subtle). 요약 본문보다 한 단 내려야 눈이
                               날짜가 아니라 내용을 먼저 잡는다 -->
                          <Typography
                            variant="body-02-normal-regular"
                            color="text-body-subtle"
                            className="mr-3 whitespace-nowrap"
                            >{r.date}</Typography
                          >
                          <!-- 미작성은 값이 아니라 상태다 — 고스트 색으로 내려
                               "쓰지 않았다"와 "이렇게 썼다"를 눈으로 가른다.
                               문구는 탭마다 다르다(상담=일지 요약 / 검사=소견) -->
                          <Typography
                            variant="body-02-normal-regular"
                            color={r.line
                              ? 'text-body-default'
                              : 'text-icon-secondary'}
                            className="min-w-0 truncate"
                            >{r.line ??
                              (chartTab === 'counseling'
                                ? '요약 미작성'
                                : '소견 미작성')}</Typography
                          >
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          {@render emptySlot(
            chartTab === 'counseling'
              ? '진행한 상담이 없어요'
              : '실시한 검사가 없어요'
          )}
        {/if}
      </div>
    </section>
  </div>
{/if}
