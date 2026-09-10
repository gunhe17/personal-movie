import { describe, it, expect, beforeEach } from 'vitest'
import { registerFormTools, type FormSpec } from './form-tools'
import { pageToolRegistry } from './registry'

function makeSpec() {
  const state = {
    name: '',
    birth: '',
    gender: '' as string,
    room: null as { id: string; name: string } | null,
    clients: [] as { id?: string; name?: string }[]
  }
  const spec: FormSpec = {
    formName: '테스트 폼',
    submitLabel: '저장',
    fields: {
      name: {
        label: '이름',
        required: true,
        get: () => state.name,
        set: (v) => (state.name = v)
      },
      birth: {
        label: '생년월일',
        kind: 'date',
        get: () => state.birth,
        set: (v) => (state.birth = v)
      },
      gender: {
        label: '성별',
        kind: 'enum',
        values: ['MALE', 'FEMALE'],
        get: () => state.gender,
        set: (v) => (state.gender = v)
      },
      room: {
        label: '장소',
        kind: 'ref',
        list: () => [{ id: 'r1', name: '상담실A' }],
        get: () => state.room,
        set: (v) => (state.room = v)
      },
      client: {
        label: '내담자',
        kind: 'ref',
        many: true,
        get: () => state.clients,
        set: (v) => (state.clients = v)
      },
      readonly_item: { label: '검사 항목', get: () => [] }
    }
  }
  return { state, spec }
}

describe('form-tools', () => {
  beforeEach(() => pageToolRegistry.unregisterAll())

  it('set_fields는 배열(구 runtime)과 딕셔너리(new_agent v5) 페이로드를 모두 수용한다', async () => {
    const { state, spec } = makeSpec()
    registerFormTools(spec)

    await pageToolRegistry.execute('page.set_fields', {
      fields: [{ field: 'name', value: '김철수' }]
    })
    expect(state.name).toBe('김철수')

    await pageToolRegistry.execute('page.set_fields', {
      fields: { name: '이영희' }
    })
    expect(state.name).toBe('이영희')
  })

  it('kind별 검증 — date/enum 실패는 에러, enum은 대소문자 무시 후 정본값', async () => {
    const { state, spec } = makeSpec()
    registerFormTools(spec)

    const bad = await pageToolRegistry.execute('page.set_field', {
      field: 'birth',
      value: '2020/01/01'
    })
    expect(bad.is_error).toBe(true)

    await pageToolRegistry.execute('page.set_field', {
      field: 'birth',
      value: '2020-01-01'
    })
    expect(state.birth).toBe('2020-01-01')

    await pageToolRegistry.execute('page.set_field', {
      field: 'gender',
      value: 'male'
    })
    expect(state.gender).toBe('MALE')
  })

  it('ref는 id→name 순 매칭으로 목록 원본을 set하고, many는 배열로 정규화한다', async () => {
    const { state, spec } = makeSpec()
    registerFormTools(spec)

    await pageToolRegistry.execute('page.set_field', {
      field: 'room',
      value: { name: '상담실A' }
    })
    expect(state.room).toEqual({ id: 'r1', name: '상담실A' })

    await pageToolRegistry.execute('page.set_field', {
      field: 'client',
      value: { id: 'c1', name: '김' }
    })
    expect(state.clients).toEqual([{ id: 'c1', name: '김' }])
  })

  it('get_form_state는 모든 필드를, set 없는 필드 쓰기는 안내 에러를 반환한다', async () => {
    const { spec } = makeSpec()
    registerFormTools(spec)

    const read = await pageToolRegistry.execute('page.get_form_state', {})
    expect(JSON.parse(read.result)).toHaveProperty('readonly_item')

    const write = await pageToolRegistry.execute('page.set_field', {
      field: 'readonly_item',
      value: 'x'
    })
    expect(write.is_error).toBe(true)
    expect(write.result).toContain('화면에서 직접')
  })

  it('set_fields 안내 문구는 다음 미입력 필수 필드를 가리킨다', async () => {
    const { spec } = makeSpec()
    registerFormTools(spec)

    const r = await pageToolRegistry.execute('page.set_fields', {
      fields: { birth: '2020-01-01' }
    })
    expect(r.result).toContain('생년월일 ✓')
    expect(r.result).toContain('이름')
  })
})
