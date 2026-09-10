---
name: mock-capture
description: "시연 영상", "촬영", "데모 녹화", "목 에이전트", "스크립트대로 화면 채우기"가 필요할 때 쓴다. 제품의 실제 에이전트 채팅 화면에서 시작해 정해진 대사와 정해진 prefill을 결정론으로 재생한다. LLM을 부르지 않아 크레딧을 안 쓰고 매 테이크가 같다.
---

# 촬영용 목 에이전트

LLM 자리만 스크립트로 바꾼다. 서버가 보내는 것과 **같은 SSE 이벤트**를 같은 순서로 흘리므로,
채팅 UI도 화면 채우기도 제품 배선을 그대로 탄다 — 촬영본의 화면 동작은 진짜다.

## 먼저 알 것 셋

1. **시작점은 제품의 `/agent` 화면이다.** 별도 채팅 패널을 띄우지 않는다. 진짜 입력창에 타이핑하면 목이 답한다.
2. **prefill은 저장하지 않는다.** 화면을 열고 채울 뿐, 제출은 사람이 한다. 등록 컷에는 사람의 저장 클릭이 필요하다.
3. **등록 안 된 사람도 넣을 수 있다.** 검사 접수의 단체 모드(`group_members`)가 조회 없이 이름·생년월일만으로 명단에 올린다.

## 재생 모드 둘

| 모드 | 언제 | 시작 |
|---|---|---|
| 채팅 재생 | 에이전트가 화면에 나오는 장면 | `/agent`에서 사용자가 전송 |
| 단축키 재생 | 에이전트 없이 화면만 세팅하는 장면 | 어느 화면에서든 `F9` |

한 스크립트로 둘 다 된다. 채팅 재생은 `progress`·`question`·`reply`를, 단축키 재생은 `tools`만 쓴다.

## 촬영 절차

1. 서비스 기동 + 시드 — `run-web` 스킬. 데이터가 없으면 화면이 비어 촬영이 안 된다.
2. 로그인 — `/login` 다음 `/welcome`에서 센터 참여 클릭. 센터 선택을 반드시 거친다.
3. `/lab/agent-mock`에서 프리셋을 고르거나 JSON을 편집하고 촬영 시작.
4. 채팅 재생이면 `/agent`로 가서 녹화를 켜고 타이핑한다. 단축키 재생이면 대상 화면에서 `F9`.
5. 되감기는 편집기의 "처음으로", 종료는 "촬영 종료".

## 스크립트 형식

```json
{
  "title": "s01 접수 — 신규 형제 단체 접수",
  "turns": [
    {
      "label": "되물음 — 아이들 정보를 묻는다",
      "progress": "요청을 처리하고 있습니다...",
      "question": "아이들 성함과 생년월일을 알려주세요."
    },
    {
      "label": "단체 모드로 전환하고 신규 아이 둘을 명단에 얹는다",
      "progress": "접수 화면을 준비하고 있습니다...",
      "reply": "햇살어린이집 단체로 접수 화면을 열었어요.",
      "tools": [
        { "name": "page.navigate", "args": { "path": "/assessment/receive" }, "delayMs": 600 },
        { "name": "page.set_fields", "delayMs": 700, "args": { "fields": {} } }
      ]
    }
  ]
}
```

| 키 | 뜻 |
|---|---|
| `label` | 이 턴이 무엇인지 적는 메모. 편집기에만 보인다 |
| `progress` | 답을 만드는 동안 뜨는 진행 문구 |
| `question` | 되물음. 이 턴은 여기서 끝나고 사용자의 다음 입력이 다음 턴을 연다 |
| `reply` | 최종 답변. 한 글자씩 흘러나온다. 속도는 `typeMs`(기본 18) |
| `tools[]` | 화면 도구. `args`가 곧 prefill 인자다 |
| `leadMs` / `delayMs` | 턴 시작 전 / 도구 발사 전 대기. 화면 전환과 입력 사이 호흡 |

되물음 턴에는 `tools`를 넣지 않는다 — 사용자 입력을 기다리는 자리라 화면을 옮기면 안 된다.

## 채울 수 있는 필드

정본은 `apps/web/src/lib/features/agent/page-tools/`의 디스크립터다. 필드를 바꾸면
백엔드 prefill 스키마(`apps/api/app/**/prefill_*.py`)도 같은 PR에서 고친다.

### `/clients/register` — 필수 이름·생년월일·연락처

`name` · `birth`(YYYY-MM-DD) · `gender`(MALE/FEMALE) · `phone` · `email` · `address` · `addressDetail` · `memo`

### `/assessment/receive` — 개인 접수

| 필드 | 형식 |
|---|---|
| `client` | `{id, name}` 또는 그 배열. 여러 명 가능 |
| `counselor` `room` | `{id, name}` |
| `date` | YYYY-MM-DD |
| `start_time` `end_time` | HH:MM |
| `memo` | 문자열 |

### `/assessment/receive` — 단체·기관 접수

등록 안 된 사람을 넣는 유일한 경로.

| 필드 | 형식 |
|---|---|
| `client_type` | `"group"` |
| `organization` | `{name}` — 신규 기관이면 이름만 |
| `group_members` | `[{name, birthDate, gender, guardianPhone}]` — DB 조회 불필요 |

`group_members`나 `organization`을 넣으면 `client_type`은 자동으로 group이 된다.
반대로 `client`를 넣으면 개인 모드로 되돌아간다.

검사 항목과 패키지는 채울 수 없다 — 화면에서 사람이 고른다.
"AI가 다 채웠고 나는 검사만 고른다"는 마지막 컷으로 쓰면 좋다.

## 함정

- **`start_time`만 넣지 말고 `end_time`을 항상 같이 넣는다.** 시작시각만 주면 화면이 기본 시간대로 밀린다(14:00을 보냈는데 18:00으로 표시된 실측).
- **담당 검사자는 `id`가 있어야 대표(주 검사자)로 잡힌다.** 이름만으로는 선택되지 않는다.
- 날짜는 미래로 둔다 — 과거 날짜는 캘린더 선택 상태가 어색하다.
- 신규 내담자 등록 컷에서는 사람의 저장 클릭이 필요하다. 저장 전에는 그 사람의 id가 없다.
- `F9`는 전역 키다. 입력란에 포커스가 있어도 동작하고, 촬영 모드가 아니면 아무 일도 없다.
- 시드를 다시 만들면 id가 죽는다. 이름만 쓴 항목은 그대로 산다.

```bash
docker exec saas-postgres psql -U imomtae -d imomtae -c "
select 'client' k, id, name from clients where deleted_at is null
union all select 'room', id, name from rooms where deleted_at is null;"
```

구성원 id는 `/api/proxy/centers/{centerId}/members` 응답에서 얻는다.

## 구성 파일

| 파일 | 역할 |
|---|---|
| `apps/web/src/lib/features/agent-mock/store.svelte.ts` | 스크립트·커서. `advance()`=단축키, `stream()`=채팅 |
| `apps/web/src/lib/features/agent-mock/presets.ts` | 프리셋 |
| `apps/web/src/lib/components/agent/MockAgentController.svelte` | `F9` 리스너. 루트 레이아웃 상주, 렌더 없음 |
| `apps/web/src/routes/(protected)/lab/agent-mock/+page.svelte` | 스크립트 편집기 |
| `apps/web/src/lib/features/agent/chat/agent-service.ts` | 목 진입점 둘 |

목 진입점이 둘인 이유: 첫 전송(`sendMessage`)과 되물음 답변(`sendInput`)이 서로 다른 경로를 탄다.
한쪽만 물리면 답변이 서버로 새어나가 "확인할 작업이 없어요"가 뜬다.

## 새 화면을 목 대상으로 추가

1. 그 페이지에 `registerFormTools(spec)` 배선이 있는지 본다. 없으면 디스크립터부터 만든다.
2. 필드 종류는 `text` · `date` · `time` · `enum` · `ref` · `raw`. 화면이 직접 정의한 객체 구조(단체 명단 등)는 `raw`로 검증 없이 넘긴다.
3. 백엔드 `prefill_*` TOOL 스키마를 같은 필드로 맞춘다 — 실제 에이전트도 그 경로를 쓰게 된다.
4. `presets.ts`에 프리셋을 넣고 브라우저에서 한 번 돌려 확인한다.

## 되돌리기

위 구성 파일 넷과 루트 레이아웃의 `MockAgentController` 두 줄, `agent-service.ts`의 목 분기 두 곳을 지운다.
`form-tools.ts`의 `raw` 종류와 검사 접수 디스크립터의 단체 필드는 제품 기능이므로 남긴다.
