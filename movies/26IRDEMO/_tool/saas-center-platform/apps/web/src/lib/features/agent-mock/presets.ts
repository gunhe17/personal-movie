/**
 * 촬영 스크립트 프리셋. 여기 값이 그대로 page tool 인자로 나간다 —
 * prefill로 채울 값을 바꾸려면 tools[].args를 고치면 된다.
 *
 * id는 개발 시드(scripts.seed.develop) 기준이라 시드를 다시 만들면 바뀐다.
 * 이름만 넣은 항목은 시드가 바뀌어도 같은 이름이 있으면 그대로 산다.
 */

import type { MockScript } from './store.svelte'

/** 통화 접수 — 신규 내담자 등록 후 검사 예약까지 */
export const CALL_INTAKE: MockScript = {
  title: '통화 접수 — 내담자 등록 후 검사 예약',
  turns: [
    {
      label: '내담자 등록 화면을 열고 통화에서 들은 값을 채운다',
      leadMs: 400,
      tools: [
        { name: 'page.navigate', args: { path: '/clients/register' } },
        {
          name: 'page.set_fields',
          delayMs: 700,
          args: {
            fields: {
              name: '이서준',
              birth: '2018-04-11',
              gender: 'MALE',
              phone: '010-2345-6789',
              memo: '어린이집 적응 어려움으로 보호자 문의'
            }
          }
        }
      ]
    },
    {
      label: '검사 접수 화면을 열고 일정까지 채운다 (등록 저장 후 진행)',
      leadMs: 400,
      tools: [
        { name: 'page.navigate', args: { path: '/assessment/receive' } },
        {
          name: 'page.set_fields',
          delayMs: 900,
          args: {
            fields: {
              client: { name: '이서준' },
              counselor: { name: '정상담' },
              room: { name: '상담실 1' },
              date: '2026-09-15',
              start_time: '14:00',
              end_time: '15:30',
              memo: '초기 발달 평가'
            }
          }
        }
      ]
    }
  ]
}

/** 기존 내담자 검사 예약만 — 짧은 컷 */
export const QUICK_ASSESSMENT: MockScript = {
  title: '검사 예약 (기존 내담자)',
  turns: [
    {
      label: '박지우 검사 접수 화면을 열고 채운다',
      leadMs: 400,
      tools: [
        { name: 'page.navigate', args: { path: '/assessment/receive' } },
        {
          name: 'page.set_fields',
          delayMs: 800,
          args: {
            fields: {
              client: { name: '박지우' },
              counselor: { name: '정상담' },
              room: { name: '상담실 1' },
              date: '2026-09-15',
              start_time: '14:00',
              end_time: '15:00'
            }
          }
        }
      ]
    }
  ]
}


/**
 * s01-접수 (26IRDEMO) — 통화 한 건이 다섯 곳으로 흩어진다.
 * 실제 에이전트 화면(/agent)에서 재생한다. 되물음 1회 → 다중 내담자 검사 접수 prefill.
 */
export const S01_INTAKE: MockScript = {
  title: 's01 접수 — 형제 둘 검사 접수',
  turns: [
    {
      label: '되물음 — 최소 정보를 묻는다',
      leadMs: 400,
      progress: '요청을 처리하고 있습니다...',
      question: '두 아이 성함과 검사 받을 날짜, 담당 선생님만 알려주세요.'
    },
    {
      label: '검사 접수 화면을 열고 형제 둘·담당자·장소·일정을 채운다',
      leadMs: 300,
      progress: '내담자와 일정을 확인하고 있습니다...',
      reply: '서은우, 이도윤 두 분으로 검사 접수 화면을 열고 담당 선생님과 일정까지 채웠어요. 검사 항목만 골라 주시면 접수됩니다.',
      tools: [
        { name: 'page.navigate', args: { path: '/assessment/receive' }, delayMs: 600 },
        {
          name: 'page.set_fields',
          delayMs: 700,
          args: {
            fields: {
              client: [{ name: '김민준' }, { name: '김서연' }],
              counselor: { name: '정상담' },
              room: { name: '상담실 1' },
              date: '2026-09-15',
              start_time: '14:00',
              end_time: '15:30',
              memo: '형제 동시 접수 — 보호자 통화 접수'
            }
          }
        }
      ]
    }
  ]
}

/**
 * s01-접수 (단체) — 아직 등록되지 않은 아이들을 기관 단체로 접수한다.
 * group_members는 DB 조회가 필요 없다 — 통화에서 들은 이름·생년월일만으로 얹힌다.
 */
export const S01_GROUP_INTAKE: MockScript = {
  title: 's01 접수 — 신규 형제 단체 접수',
  turns: [
    {
      label: '되물음 — 아이들 정보를 묻는다',
      leadMs: 400,
      progress: '요청을 처리하고 있습니다...',
      question: '아이들 성함과 생년월일, 검사 날짜와 담당 선생님을 알려주세요.'
    },
    {
      label: '단체 모드로 전환하고 신규 아이 둘을 명단에 얹는다',
      leadMs: 300,
      progress: '접수 화면을 준비하고 있습니다...',
      reply:
        '햇살어린이집 단체로 접수 화면을 열었어요. 아직 등록되지 않은 두 아이는 명단에 바로 올렸고, 담당 선생님과 일정까지 채웠어요. 검사 항목만 골라 주세요.',
      tools: [
        { name: 'page.navigate', args: { path: '/assessment/receive' }, delayMs: 600 },
        {
          name: 'page.set_fields',
          delayMs: 700,
          args: {
            fields: {
              client_type: 'group',
              organization: { name: '햇살어린이집' },
              group_members: [
                {
                  name: '서은우',
                  birthDate: '2019-05-02',
                  gender: 'male',
                  guardianPhone: '010-2345-6789'
                },
                {
                  name: '이도윤',
                  birthDate: '2020-11-18',
                  gender: 'male',
                  guardianPhone: '010-3456-7890'
                }
              ],
              counselor: { name: '정상담' },
              room: { name: '상담실 1' },
              date: '2026-09-15',
              start_time: '14:00',
              end_time: '15:30',
              memo: '어린이집 단체 발달 선별 — 보호자 통화 접수'
            }
          }
        }
      ]
    }
  ]
}

export const PRESETS: { key: string; label: string; script: MockScript }[] = [
  { key: 'call-intake', label: '통화 접수 (등록 → 검사)', script: CALL_INTAKE },
  { key: 'quick-assessment', label: '검사 예약만 (짧은 컷)', script: QUICK_ASSESSMENT },
  { key: 's01-intake', label: 's01 접수 (에이전트 화면)', script: S01_INTAKE },
  { key: 's01-group', label: 's01 단체 접수 (신규 인물)', script: S01_GROUP_INTAKE }
]
