import { describe, expect, it } from 'vitest'
import { condLabel, deriveOldFields, pruneEmptyRows } from './record-derive'

const R = {
  금액: [{ 명칭: '서비스 가격', 주기: '월', 적용대상: '아동', 금액: [
    { 조건: { 구분: '1등급(기초생활수급자, 차상위)' }, 금액: 200000, 정부지원금: 180000, 본인부담금: 20000, 정부지원비율: 90 },
    { 조건: { 등급: '2등급' }, 금액: 200000, 정부지원금: 160000, 본인부담금: 40000, 정부지원비율: 80 }
  ] }],
  서비스: [{ 유형명: '필수', 내용: [{ 설명: '악기 제공' }, { 설명: '' }] }]
}

describe('record-derive flat v2', () => {
  it('금액 묶음의 등급표 행을 support_amount 등급별로 파생', () => {
    const { support_amount, support_scope } = deriveOldFields(structuredClone(R)) as any
    expect(support_amount.등급별).toHaveLength(2)
    expect(support_amount.등급별[0].기준).toContain('1등급')
    expect(support_amount.등급별[1].정부지원금).toBe(160000)
    expect(support_scope).toContain('악기 제공')
  })
  it('condLabel · pruneEmptyRows', () => {
    expect(condLabel({ 조건: { 등급: '2등급', 연령: '만7세' } })).toBe('2등급 · 만7세')
    const p = pruneEmptyRows(structuredClone(R)) as any
    expect(p.서비스[0].내용).toHaveLength(1)
    p.금액[0].금액.push({ 조건: { 구분: '' }, 정부지원금: null, 본인부담금: null })
    expect(pruneEmptyRows(p).금액[0].금액).toHaveLength(2)
  })
  it('신 축(집단규모·절차·운영규칙·결격)의 빈 행도 정리', () => {
    const p = pruneEmptyRows({
      집단규모: [{ 값: '1:1' }, { 값: '' }],
      절차: [{ 내용: '읍면동 신청' }, { 내용: '  ' }],
      운영규칙: [{ 종류: '지원기간', 내용: '최대 12개월' }, { 종류: '', 내용: '' }],
      제공인력: { 자격경로: [{ 내용: '임상심리사' }], 결격: [{ 내용: '전력자' }, { 내용: '' }] }
    }) as any
    expect(p.집단규모).toHaveLength(1)
    expect(p.절차).toHaveLength(1)
    expect(p.운영규칙).toHaveLength(1)
    expect(p.제공인력.결격).toHaveLength(1)
  })
})
