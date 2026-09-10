# Agent Page Tools — 폼 읽기/쓰기 계약

agent(LLM)가 사용자 발화에서 뽑은 값으로 화면의 입력 폼을 대신 읽고/채우는 계층.
**필드 계약의 정본은 이 디렉터리의 디스크립터 파일이다** — 백엔드 prefill 스키마는 이것을 미러링한다.

## 구조

```
executor.ts      SSE step_tool_call 진입점. page.navigate만 직접 처리(직렬 큐), 나머지는 registry로 위임
registry.ts      페이지 단위 도구 등록/해제/실행. navigate 직후 핸들러 등록 race를 폴링으로 흡수
form-tools.ts    ★ 공통 엔진 — FormSpec 선언 하나에서 아래 도구 세트를 파생
{form}.ts        폼별 디스크립터 (필드 선언만, 로직 없음)
```

파생되는 도구 세트 (읽기/쓰기 구분):

| 도구 | 방향 | 동작 |
|------|------|------|
| `page.get_form_state` | 읽기 | 모든 필드 `get()` + `extraState` + `can_submit`를 JSON으로 |
| `page.set_field` | 쓰기 | 단일 필드 — kind별 검증·ref 해석 후 `set()` |
| `page.set_fields` | 쓰기 | 복수 필드 일괄 + "다음 미입력 필수 필드" 안내 문구 |
| `page.submit` | 쓰기 | 필수 필드 검증 후 제출 (FormSpec에 `submit`이 있을 때만) |
| `page.focus_field` | 안내 | 필드 라벨 안내 문구 반환 |

## FieldSpec kind

| kind | 검증/해석 | set이 받는 값 |
|------|-----------|---------------|
| `text` (기본) | 문자열 강제 | `string` |
| `date` | `YYYY-MM-DD` 정규식 | `string` |
| `time` | `HH:mm` 정규식 | `string` |
| `enum` | `values` 대소문자 무시 매칭 | 정본값 `string` |
| `ref` | `{id?, name?}` 정규화. `list` 있으면 id→name 순 매칭(LLM id 절단 대비) | 목록의 원본 항목 |
| `ref` + `many` | 배열 정규화 (list 매칭 생략) | `RefValue[]` |

- `required`: 미입력 안내·submit 검증 대상. 함수면 조건부(예: 방문검사일 때만).
- `set` 없는 필드 = 읽기 전용 — 쓰기 시도에 "화면에서 직접 선택해주세요" 반환.
- `beforeWrite`: 쓰기 직전 훅 (센터 정보의 view→edit 전환).

## 새 폼 연결 방법

1. 이 디렉터리에 `{form}.ts` 디스크립터 생성 — `registerFormTools(spec)` 호출 함수 export.
2. 페이지(또는 모달 컴포넌트) `onMount`에서 등록, `onDestroy`에서 `if (browser) pageToolRegistry.unregisterAll()`.
3. 백엔드에 prefill tool 추가: `apps/api/app/runtime/new_agent/common/prefill.py`의 `PREFILL_SPECS`
   (+ 구 runtime 사용 중이면 `apps/api/app/runtime/agent/mutation/prefill.py`의 `PREFILL_CONFIG`).
4. 모달 폼은 query-string navigate(`?action=create&...`) 선례를 따르거나(center/program 참고),
   모달 컴포넌트 onMount에서 직접 등록한다 — registry는 동적 등록/해제를 이미 지원한다.

## 🔴 동기화 불변식 (hook이 편집 시 알림)

- **폼 페이지의 필드 구조가 바뀌면** (필드 추가/삭제/이름 변경, required 조건 변경) → 해당 디스크립터를 같이 고친다.
- **디스크립터의 필드 키가 바뀌면** → 백엔드 `PREFILL_SPECS`(new_agent)·`PREFILL_CONFIG`(구 agent)의 스키마/매핑을 같이 고친다. 필드 키 = LLM이 tool 인자로 쓰는 이름이다.
- `page.set_fields`의 `fields` 페이로드는 **배열 `[{field, value}]`(구 runtime)과 딕셔너리 `{field: value}`(new_agent v5) 둘 다 수용**한다 — form-tools의 `normalizeFields`가 흡수. 백엔드 포맷을 바꿔도 여기는 안 깨진다.
- 이 불변식의 감시자: `.claude/hooks/check_agent_form_tools_sync.py` (PostToolUse).
