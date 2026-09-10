/**
 * 온톨로지 어휘 소비 모듈 — 정의는 여기 없다.
 *
 * 어휘의 정본은 `./profiles/*.json`(기관별 온톨로지 프로필)이며, 이 모듈은 그것을
 * 빌드타임에 주입받아 소비만 한다(결정장부 A5 — 주입 시점 중립). 개념·바인딩 정본은
 * 레포 루트 `ontology/`(catalog·bindings·attributes)에 그대로 있고, 여기는 그 중
 * 웹이 빌드타임에 소비하는 프로필만 둔다.
 * 기관 유형 확장 시: centers.center_type 구현 후 이 import를 런타임 프로필 로드로
 * 교체한다 — t()/has()를 쓰는 화면 코드는 무변.
 *
 * 프로필을 바꿔보려면 아래 import 대상만 바꾸면 된다(예: shelter.json).
 */
import profile from './profiles/center.json'

type UiVocabKey = 'subject' | 'guardian' | 'child' | 'sibling'

/** 온톨로지 프로필 vocab 키 → UI 소비 키 사상 */
const VOCAB: Record<UiVocabKey, string | null> = {
  subject: profile.vocab.subject ?? null,
  guardian: profile.vocab.guardianRel ?? null,
  child: (profile.vocab as Record<string, string | null>).child ?? null,
  sibling: (profile.vocab as Record<string, string | null>).sibling ?? null
}

/** 어휘 조회. 존재하지 않는 개념(null)은 has()로 먼저 가드한다 — 번역이 아니라 제거(A3). */
export function t(key: UiVocabKey): string {
  return VOCAB[key] ?? ''
}

/** 개념 존재 여부 — false면 관련 탭·섹션·배지를 그리지 않는다 */
export function has(key: 'guardian' | 'sibling'): boolean {
  return VOCAB[key] !== null
}

/**
 * 한국어 조사 결합 — 어휘가 프로필에 따라 바뀌므로 조사도 받침에 따라 골라야 한다.
 * josa('내담자', '을/를') === '내담자를', josa('학생', '을/를') === '학생을'
 */
export function josa(
  word: string,
  pair: '을/를' | '이/가' | '은/는' | '과/와'
): string {
  const [withFinal, withoutFinal] = pair.split('/')
  const last = word.charCodeAt(word.length - 1)
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0
  return word + (hasFinal ? withFinal : withoutFinal)
}

/**
 * role 파생 헬퍼 — 저장 enum(client|guardian|both)을 화면이 직접 비교하지 않기 위한 유일한 통로.
 * (결정장부 D3: role은 관계의 요약 캐시 — 화면 의미는 여기서 파생)
 */
export function hasGuardianRole(role: string | null | undefined): boolean {
  return role === 'guardian' || role === 'both' || role === 'GUARDIAN' || role === 'BOTH'
}
