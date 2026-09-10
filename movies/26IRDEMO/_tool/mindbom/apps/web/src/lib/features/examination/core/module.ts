/**
 * 검사 모듈 — 검사가 "자기가 어떤 검사인지"만 선언하는 곳.
 *
 * 진행 화면의 골격(사이드바·헤더·단계 이동·잠금)은 코어가 처리하고,
 * 검사별로 다른 것(제목, 단계 구성, 각 단계 화면)만 모듈이 선언한다.
 * 새 검사를 붙일 때 라우트를 복제하지 않고 모듈 하나만 추가하면 된다.
 *
 * 설계 근거: docs/plan-exam-module-architecture.md §8
 */
import type { Component } from 'svelte'
import type { TableMeta } from '$lib/components/document-editor/editor-core'
import type { ExamStatus } from '../common/constants'

/**
 * 종합보고서 편집기에 끼워 넣을 수 있는 자료 한 건.
 *
 * 검사 결과에서 뽑아낸 그림 또는 표다. 검사마다 무엇을 뽑을지가 완전히 다르므로
 * (HTP는 그림+해석표, SCT는 점수표, 로르샤하는 클러스터표) 추출은 모듈이 하고
 * 리포트 화면은 결과만 받아 렌더한다.
 *
 * 소속 검사 메타(examId·examLabel)는 리포트 화면이 붙인다 — 모듈은 자기가
 * 어느 검사 인스턴스인지 모른다.
 */
export interface ReportAsset {
  id: string
  name: string
  kind: 'image' | 'table'
  /** kind가 'image'일 때 — 이미 해석이 끝난 절대 URL */
  src?: string
  /** kind가 'table'일 때 */
  table?: TableMeta
  /** 표 행 수 (목록에 개수 표시용) */
  count?: number
}

/**
 * 검사가 어디까지 진행됐는지 — status와는 별개의 축.
 *
 * 서버가 서브모듈 데이터를 보고 계산해 상세 응답에 실어 준다
 * (apps/api/.../common/progress.py). 검사마다 수집 단위가 달라
 * 개수는 없을 수 있고(로르샤하는 세션 종료 하나로 결정된다),
 * collect_done만 항상 채워진다.
 */
export interface ExamProgress {
  collect_done: boolean
  collected_count?: number | null
  collect_total?: number | null
  has_result: boolean
}

/**
 * 단계 진입 판정에 쓰이는 입력.
 *
 * status만으로는 판정할 수 없다 — 세 검사 모두 "수집 완료"를 status에
 * 남기지 않기 때문이다(로르샤하는 기록을 마쳐도 in_progress). 그래서
 * 판정 함수는 두 축을 함께 받는다.
 */
export interface ExamGate {
  status: ExamStatus
  progress: ExamProgress | null
}

/**
 * 단계 식별자 — URL 세그먼트로 쓰인다. 17종 공통 어휘.
 *
 *   collect : 피검자·보호자의 원자료 수집 (응답·이미지·음성)
 *   inquiry : 수집한 원자료를 놓고 되짚어 묻는 단계
 *   record  : 검사자가 관찰·수행 결과를 직접 입력
 *   score   : 규칙 기반 규준 변환
 *   review  : 초안·채점 검토·수정
 *   results : 최종 결과 열람
 *   setup   : 연령·검사 폼·소검사 구성 선택
 *
 * collect(피검자 입력)와 record(검사자 입력)를 나눈 게 핵심이다 —
 * 누가 입력하는가가 권한·감사추적을 가른다.
 *
 * inquiry는 투사검사 일반의 절차 어휘다. 로르샤하의 질문 단계가 대표적이고
 * (수집이 다 끝난 뒤 처음부터 다시 순회하며 "어디가 그렇게 보였나요"를 묻는다),
 * HTP의 사후질문(PDI)도 같은 자리에 있다. collect와 나누는 이유는 절차상
 * **수집이 다 끝난 뒤에** 해야 하기 때문이다 — 중간에 끼우면 피검자가
 * 방어적이 되어 이후 산출이 왜곡된다.
 *
 * 현행 3종은 collect / review / results 를 쓴다.
 * `inquiry`는 지금 아무도 안 쓴다 — 로르샤하가 질문을 별도 스텝으로 두었다가
 * 실시 화면으로 합쳤다(§14-1). 어휘 자체는 투사검사 일반의 것이라(HTP의 PDI가
 * 같은 자리다) 남겨둔다. setup·record·score도 A·C군 검사용 예약이다.
 */
export type StepKey =
  | 'setup'
  | 'collect'
  | 'inquiry'
  | 'record'
  | 'score'
  | 'review'
  | 'results'

/** ExamStep에서 잠금 관련 두 필드를 뺀 나머지 — 아래 조건부 타입의 공통 부분. */
interface ExamStepBase {
  /** URL 세그먼트 겸 식별자 */
  key: StepKey
  /** 사이드바 표기 — 검사 고유 어감을 살린다 (예: '채점하기') */
  label: string
  /**
   * Material Symbols 아이콘 이름.
   *
   * 필수다 — 셸이 조건부로 렌더하므로 하나만 빠져도 그 행의 라벨이
   * 아이콘 폭만큼 왼쪽으로 밀려 사이드바 정렬이 어긋난다.
   */
  icon: string
  /** 이 단계를 그리는 컴포넌트. 지연 로딩 — 17종이 초기 번들에 들어가면 안 된다. */
  component: () => Promise<{ default: Component<any> }>
  /**
   * 이미 끝난 단계인지 — 사이드바 '완료' 배지.
   *
   * **"사람이 이 단계에서 할 일을 마쳤나"**를 뜻한다. "다음 단계가 열렸나"
   * (= enabled)가 아니다. 둘을 같은 식으로 두면 단계가 열리는 순간 '완료'가
   * 떠서 뱃지가 아무 정보도 주지 않는다(HTP results가 실제로 그랬다).
   *
   * 마지막 단계(results)의 완료는 임상가 확정 = isConfirmed(status)로 통일한다.
   * AI 결과가 생긴 것(progress.has_result)은 다른 축이며, 그걸로 '완료'를
   * 판정하면 임상가 확인 전에 끝났다고 말하는 셈이라 CDSS 원칙에 어긋난다.
   *
   * 생략하면 이 단계는 영영 '완료'가 되지 않는다.
   */
  done?: (gate: ExamGate) => boolean
}

/**
 * 단계 선언 — 잠금 규칙이 있으면 사유도 반드시 함께 온다.
 *
 * 예전에는 enabled와 lockedHint가 둘 다 optional이라 잠금만 걸고 사유를
 * 빠뜨릴 수 있었다. 그러면 사용자는 사이드바에서 튕겨 나오면서 아무 설명도
 * 듣지 못한다([step]/+page.svelte가 lockedHint가 있을 때만 스낵바를 띄운다).
 * 타입으로 짝을 묶어 두 필드가 어긋날 수 없게 한다.
 */
export type ExamStep =
  | (ExamStepBase & {
      /** 진입 가능 여부 */
      enabled: (gate: ExamGate) => boolean
      /** 잠겼을 때 보여줄 사유 — enabled가 있으면 필수 */
      lockedHint: string
    })
  | (ExamStepBase & {
      /** 잠금 규칙이 없는 단계 — 항상 진입 가능하다 */
      enabled?: undefined
      lockedHint?: undefined
    })

export interface ExamModule {
  /**
   * 검사 식별자 — DB의 exam_type과 같은 값.
   *
   * 여기서 유니온을 요구하면 레지스트리(타입의 단일 출처)와 순환 참조가 된다.
   * 유효한 값인지는 레지스트리 키가 보장하고, 여기서는 선언만 받는다.
   */
  type: string
  /** 사이드바 상단 검사명 (예: 'SCT 검사') */
  title: string
  /** 검사명 아래 한 줄 설명 */
  subtitle: string
  /**
   * 목록·배지·필터에서 쓰는 짧은 이름 (예: '로샤').
   *
   * title('로샤 검사')과 나누는 이유: 좁은 칸에는 짧은 이름이 필요한데,
   * 예전에는 이게 모듈 밖 세 곳(EXAM_TYPE_LABELS·EXAM_TYPE_VISUAL·필터 옵션)에
   * 흩어져 있어 같은 검사가 '로샤'·'로르샤하'로 갈렸다.
   */
  shortLabel: string
  /**
   * 검사의 정식 한글 명칭 (예: '로르샤하').
   *
   * shortLabel('로샤')·subtitle('잉크반점 검사')과 셋 다 다르다. 셋은 자리가
   * 다르다 — shortLabel은 좁은 배지, subtitle은 검사가 뭔지 풀어 쓴 설명,
   * 이건 배지 옆에 정식 이름을 적는 자리(종합보고서 자료 목록)다.
   *
   * subtitle에서 기계적으로 파생시키지 않는다. 잘라 보면 '잉크반점'·
   * '집-나무-사람 그림'처럼 이름도 설명도 아닌 말이 된다.
   */
  fullName: string
  /** 목록 배지 색 — Tailwind 클래스 */
  pillClass: string
  /**
   * 검사 심볼 색 — 큰 원형 블록의 배경(진한 색, 흰 글자를 얹는다).
   *
   * pillClass와 나누는 이유: pillClass는 좁은 배지용이라 연한 배경 + 진한
   * 글자 조합인데, 원형 블록은 반대로 진한 배경 + 흰 글자다. 한 값으로
   * 둘 다 감당하면 어느 한쪽의 대비가 무너진다.
   *
   * 값은 운영 플랫폼(마인드스코프)의 검사별 심볼 색과 맞춘다 — 같은 검사가
   * 두 제품에서 다른 색으로 보이지 않도록.
   *
   * 예전에는 ExamTypeIcon.svelte가 `{#if type === 'htp'}` if-체인으로 세 검사의
   * SVG를 직접 갖고 있었다. 모듈이 title·shortLabel·pillClass를 다 선언하는데
   * 아이콘만 밖에 있어, 새 검사를 붙일 때 모듈만 봐서는 거기를 고쳐야 하는지
   * 알 수 없었다(프론트에 마지막으로 남아 있던 exam_type 분기).
   */
  symbolColor: string
  /*
   * scoringMode('ai' | 'auto')는 제거했다.
   *
   * 플랜 §7 Q2는 "상태 경로를 결정하는 동작"이라 정당화했지만, 실제로는
   * 값을 읽는 코드가 한 곳도 없었다(세 모듈이 전부 'ai'를 채우고 테스트는
   * 'auto'를 넣지만 어떤 단언도 이 필드를 보지 않았다).
   *
   * 게다가 core/status.ts 주석이 정반대를 말한다 — "채점 방식과 무관하게
   * 같은 경로를 쓴다. AI 채점이 없는 표준화 검사도 우회 없이 이 경로를 탄다."
   * 선언과 구현 중 구현이 맞았다.
   *
   * 진짜 분기가 필요해지면(예: 결과 화면의 'AI 초안' 문구 노출) 그때 소비처와
   * 함께 되살린다. 플랜 §8-2의 "섣불리 만들지 않는다"와 같은 판단이다.
   */
  steps: ExamStep[]

  /**
   * 이 검사의 보고서 PDF를 내려받는다.
   *
   * 지연 로딩한다 — 검사 상세 화면은 보고서를 받지 않고도 열리므로, 세 검사의
   * PDF 코드를 초기 번들에 넣지 않는다.
   *
   * 생략하면 이 검사는 보고서를 지원하지 않는 것으로 본다(화면이 안내를 띄운다).
   * 예전에는 상세 화면이 exam_type if-체인으로 세 검사의 다운로드 방식을
   * 직접 알고 있었다 — 새 검사를 붙일 때 모듈만 봐서는 여기를 고쳐야 하는지
   * 알 수 없었다.
   */
  downloadReport?: (instId: string, examId: string) => Promise<void>

  /**
   * 종합보고서 편집기에 끼워 넣을 자료(그림·표)를 뽑아낸다.
   *
   * 무엇을 뽑을지는 검사마다 완전히 다르다 — HTP는 그림과 해석표, SCT는
   * 영역별 점수표, 로르샤하는 클러스터·특수지표표. 예전에는 이 추출 로직
   * 135줄과 검사별 라벨표가 전부 리포트 화면에 있었다.
   *
   * 생략하면 이 검사는 자료를 제공하지 않는다(목록에 안 뜬다).
   */
  loadReportAssets?: (instId: string, examId: string) => Promise<ReportAsset[]>
}

/**
 * 지금 이어서 할 단계 — 진입 시 여기로 보낸다.
 *
 * **아직 끝나지 않은 첫 단계**를 고른다. 전부 끝났으면 마지막 단계다.
 *
 * 예전에는 "진입 가능한 것 중 마지막"이었다. 그 규칙은 모든 단계가 enabled로
 * 순서를 잠근다는 전제 위에 서 있었는데, 로르샤하가 되돌아가기 잠금을
 * 폐기하면서(문서 §3-1 "게이트는 결과 하나뿐") 전제가 깨졌다 — 잠금이 없으면
 * 전부 "진입 가능"이라, 아무것도 안 한 새 검사를 열어도 채점 화면으로 갔다.
 * done을 함께 보면 잠금이 있든 없든 같은 답이 나온다.
 * (HTP·SCT는 이 변경으로 판정이 달라지지 않는다 — 잠금과 done이 같은 축을
 *  보고 있어서 두 규칙이 같은 자리를 가리킨다.)
 *
 * progress를 아직 모르면(exam 로드 전) 무조건 첫 단계다. 그 상태로 뒤 단계를
 * 골라 주면 데이터가 오기 전에 빈 결과 화면을 그린다.
 *
 * **이 판정은 코어가 한다.** 예전에는 로르샤하 모듈만 results의 enabled에
 * `progress !== null`을 덧대 자기 검사에서만 막았다. HTP·SCT가 안전했던 건
 * 규칙을 지켜서가 아니라 판정식이 마침 progress를 참조해서 생긴 우연이었고
 * (`progress?.has_result`는 progress가 null이면 저절로 false),
 * 로르샤하처럼 status 축으로 판정하는 검사에는 그 우연이 통하지 않는다.
 * 규칙을 모듈에 맡기면 새 검사가 판정 축을 바꾸는 순간 조용히 깨진다.
 */
export function resolveActiveStep(module: ExamModule, gate: ExamGate): ExamStep {
  if (gate.progress === null) return module.steps[0]
  const allowed = module.steps.filter((s) => !s.enabled || s.enabled(gate))
  // 진입 가능한 게 없으면(상태가 이상하면) 첫 단계로 폴백
  if (allowed.length === 0) return module.steps[0]

  // done을 선언한 단계만 "끝났는지"를 물을 수 있다. 선언하지 않은 단계를
  // 미완료로 치면 그 자리에 멈춘다 — 잠금만으로 순서를 세운 검사(가상
  // MMPI-2·K-WISC-V가 그렇다)가 첫 단계에 갇힌다.
  const last = allowed[allowed.length - 1]
  const unfinished = allowed.find((s) => s.done && !s.done(gate))
  return unfinished ?? last
}

/**
 * 지금 단계의 앞/뒤 이웃 — 푸터의 '이전'·'다음' 버튼이 쓴다.
 *
 * **진입 가능한 것만 돌려준다.** 잠긴 단계를 가리키면 버튼은 눌리는데 눌러도
 * 되돌려 보내진다([step]/+page.svelte의 잠금 가드). 실제로 SCT는 확정 후
 * collect가 잠기는데 결과 화면의 '이전'이 그리로 향해 튕겨 나왔다.
 * 갈 곳이 없으면 null — 호출부는 버튼을 감춘다.
 *
 * 순서의 출처는 모듈 선언 하나다. 예전에는 화면 14곳이 `/collect`·`/review`
 * 같은 경로를 문자열로 직접 적어, 모듈에서 단계를 넣거나 빼도 그 14곳은
 * 알지 못했다([[principle-homomorphic-check]]).
 */
export function stepNeighbors(
  module: ExamModule,
  currentKey: string,
  gate: ExamGate
): { prev: ExamStep | null; next: ExamStep | null } {
  const i = module.steps.findIndex((s) => s.key === currentKey)
  if (i < 0) return { prev: null, next: null }

  const openable = (s: ExamStep) => !s.enabled || s.enabled(gate)
  // 바로 옆이 잠겨 있으면 그 너머까지 본다 — 중간 단계가 조건부인 검사가 있다.
  const back = module.steps.slice(0, i).filter(openable)
  const fwd = module.steps.slice(i + 1).filter(openable)

  return { prev: back.at(-1) ?? null, next: fwd[0] ?? null }
}

/** progress를 아직 모를 때의 판정 입력 — 수집도 결과도 없는 것으로 본다. */
export function gateFrom(
  status: ExamStatus | string | undefined,
  progress: ExamProgress | null | undefined
): ExamGate {
  return { status: (status ?? 'created') as ExamStatus, progress: progress ?? null }
}
