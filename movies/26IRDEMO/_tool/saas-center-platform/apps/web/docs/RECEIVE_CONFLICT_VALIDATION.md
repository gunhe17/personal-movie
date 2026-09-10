# 접수 시 장소/시간 중복(Conflict) Validation 로직

> 검사·상담 접수에서 "같은 장소·같은 시간대" 충돌이 어떻게 감지·처리되는지에 대한 기술 문서.
> 코드 근거: 모든 클레임에 파일 경로 + 라인 번호 첨부.

---

## 1. 핵심 결론 (TL;DR)

| 항목 | 결과 |
|---|---|
| 검사 대상 | 같은 센터 + 같은 **장소(room)** + 시간대 겹침 |
| 검사 기준 | `A.start < B.end AND A.end > B.start` (표준 overlap 공식) |
| 담당자(counselor) 중복 검사 | ❌ **없음** |
| 차단(blocking) 여부 | ❌ **경고만**. 충돌이 있어도 접수/일정 생성은 **그대로 진행** |
| 예외 | 상담 접수의 **중복 케이스 체크**(5분 이내 동일 내담자·프로그램·상담사)만 **409로 차단** |

> "장소가 겹친다"는 것은 **거부 사유가 아니라 경고**다.

---

## 2. 시스템 레이어 개요

```
[Frontend]                                      [Backend]
MultiDateSchedulePicker ──(debounce 400ms)──▶ POST /schedules/validate-dates
  └ 경고 배너 표시 (amber)                        └ ValidateDatesSchedulesService

폼 제출(접수) ──▶ POST /assessment-cases/individual
              ──▶ POST /centers/{id}/counseling/intake
                     └ Handler ── Facade.create_schedule_with_conflicts
                                     └ CreateScheduleService
                                         └ repo.find_conflicting_schedules  ◀── 핵심 쿼리
```

---

## 3. 핵심 쿼리: `find_conflicting_schedules`

**파일**: `apps/api/app/modules/schedule/repository.py:70-108`

```python
async def find_conflicting_schedules(
    self, center_id, room_id, start, end, exclude_id=None
) -> list[Schedule]:
    conditions = [
        Schedule.center_id == center_id,
        Schedule.room_id == room_id,                       # 같은 장소
        Schedule.start < end,                              # 시간 겹침
        Schedule.end > start,                              # 시간 겹침
        Schedule.deleted_at.is_(None),                     # 소프트 삭제 제외
        Schedule.id.notin_(_CANCELLED_ONLY_SCHEDULE_IDS),  # 전체 취소 제외
    ]
    if exclude_id:
        conditions.append(Schedule.id != exclude_id)       # 편집 시 자기 자신 제외
    ...
```

### 3.1 충돌 조건 (6가지 필터)

| # | 조건 | 의미 |
|---|---|---|
| 1 | `center_id == center_id` | 같은 센터 내 일정만 |
| 2 | `room_id == room_id` | **장소가 완전히 같아야 충돌** — 다르면 절대 충돌 아님 |
| 3 | `start < end` | 기존 일정이 새 일정 끝보다 먼저 시작 |
| 4 | `end > start` | 기존 일정이 새 일정 시작보다 늦게 끝 |
| 5 | `deleted_at IS NULL` | 소프트 삭제된 일정 제외 |
| 6 | `NOT IN (cancelled_only_ids)` | **모든 세션이 `cancelled`인 일정은 무시** |

### 3.2 "전체 취소" 제외 서브쿼리

**파일**: `apps/api/app/modules/schedule/repository.py:10-18`

```sql
SELECT schedule_id FROM (
    SELECT schedule_id, status FROM assessment_sessions WHERE deleted_at IS NULL
    UNION ALL
    SELECT schedule_id, status FROM counseling_sessions WHERE deleted_at IS NULL
) _sessions
GROUP BY schedule_id
HAVING COUNT(*) = SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)
```

- 한 schedule에 세션이 여러 개 붙을 수 있음. **모두 `cancelled`**면 그 schedule은 충돌 검사에서 제외.
- 세션이 하나라도 살아있으면 충돌로 간주.

### 3.3 시간 겹침 판정표

```
기존 일정 B:        ████████
새 일정 A의 경우:
  ▲ 완전 이전    ██                  → OK (end ≤ start)
  ▲ 앞 겹침        ████              → 충돌
  ▲ 포함           ████              → 충돌
  ▲ 뒷 겹침            ████          → 충돌
  ▲ 완전 이후              ██        → OK (start ≥ end)
  ▲ 경계 접촉    ██▐                  → OK (strict <, >)
```

> `<`, `>` 를 쓰므로 **끝시간=시작시간**(10:00–11:00 바로 뒤 11:00–12:00)은 **충돌 아님**.

---

## 4. 프런트엔드 사전 검증 (경고 배너)

### 4.1 호출 지점

**파일**: `apps/web/src/lib/components/schedule/MultiDateSchedulePicker.svelte:248-331`

- **디바운스 400ms**로 room/dates/start_time/end_time 변경 감지
- 다음 조건이 모두 충족되어야 요청:
  - `center_id`, `room_id`
  - `dates` 1개 이상
  - `start_time`, `end_time` (`HH:MM`)
- 편집 모드면 `exclude_schedule_id` 추가

### 4.2 요청/응답 스펙

**Endpoint**: `POST /schedules/validate-dates`
**파일**: `apps/api/app/modules/schedule/handlers/validate_dates_schedules.py:7-28`, `services/validate_dates_schedules.py:14-83`

```json
// Request
{
  "center_id": "uuid",
  "room_id": "uuid",
  "dates": ["2026-04-21T00:00:00", "2026-04-22T00:00:00"],
  "start_time": "10:00",
  "end_time": "11:00",
  "exclude_schedule_id": "uuid?"
}
```

```json
// Response
{
  "has_conflicts": true,
  "conflicts": [
    {
      "session_number": 1,
      "date": "2026-04-21T01:00:00",
      "conflicting_schedules": [
        {
          "id": "...",
          "title": "...",
          "start": "...",
          "end": "...",
          "schedule_type": "counseling",
          "room_name": "상담실 A"
        }
      ]
    }
  ]
}
```

### 4.3 내부 처리 (Service)

- 각 date에 대해 `KST start/end` 조합 → `UTC naive` 변환 (−9h) → `find_conflicting_schedules` 호출
- 날짜별로 `session_number`와 함께 충돌 정보 수집해서 반환

### 4.4 UI 표시

**파일**: `apps/web/src/lib/components/schedule/MultiDateSchedulePicker.svelte:688-761`

```svelte
{#if conflictCount > 0}
  <div class="rounded-lg bg-amber-50 ...">
    선택한 시간에 <strong>{roomLabel}</strong> 일정이 있어요
    다른 장소를 선택하거나 날짜를 변경해보세요
  </div>
{/if}
```

- **amber(노랑) 배너** + 해당 날짜 row에 `border-semantic-notice/40 bg-amber-50`
- **제출 버튼을 막지 않음** — 사용자에게 "겹칩니다"라고 알려줄 뿐

---

## 5. 접수 서브밋 플로우

### 5.1 검사 접수 (Assessment)

**핸들러**: `apps/api/app/application/handlers/assessment/create_individual.py:29-193`
**프런트 서비스**: `apps/web/src/lib/features/assessment/receive/receive-service.ts:496-663`
**프런트 validation**: `apps/web/src/lib/features/assessment/receive/hooks.svelte.ts:101-143`

```
① 클라이언트 폼 validation (hooks.svelte.ts)
    - client, assessment, counselor 필수
    - visitCenter=true 이면 room, schedule 필수
    - ※ 충돌 체크는 여기 없음

② POST /assessment-cases/individual
   └ handler
     ├─ Case/Participants/Tasks 생성
     ├─ has_schedule=true 면:
     │   schedule_facade.create_schedule_with_conflicts(...)
     │   └─ CreateScheduleService.execute()
     │       ├─ acquire_room_lock (동시성 제어)
     │       ├─ find_conflicting_schedules() ← 충돌 탐지
     │       └─ schedule.create()            ← 충돌 있어도 무조건 생성
     │   → (schedule, conflicts) 반환
     ├─ Session 생성
     └─ 알림 발송(상담사/내담자 SMS)

③ Response: { case_id, case_code, session_id, schedule_id, created_at }
   └ ⚠ 충돌 정보는 응답에 포함되지 않음 (FE는 "성공"만 확인)
```

### 5.2 상담 접수 (Counseling)

**핸들러**: `apps/api/app/application/handlers/counseling/create_case_with_sessions.py:29-305`

검사 접수와 거의 동일하지만 **두 가지 차이**:

#### ① 중복 케이스 체크 (blocking)

```python
is_duplicate, duplicate_case_code = await case_facade.check_duplicate_case(
    center_id=center_id,
    program_id=...,
    counselor_id=...,
    client_ids=...,
    first_session_start=session_dates[0],
    room_id=...,
    minutes_threshold=5,
)
if is_duplicate:
    raise ConflictException(...)   # 409 차단
```

- **같은 센터 + 프로그램 + 상담사 + 내담자 + 장소** + **첫 회기 시작시각 ±5분** → 중복, 409 에러
- "장소 겹침"이 아니라 **"같은 케이스 중복 등록"** 방지용

#### ② 회기별 충돌을 `warnings[]`로 응답에 포함

```python
for idx, session_start in enumerate(session_dates):
    schedule, conflicts = await schedule_facade.create_schedule_with_conflicts(...)
    if conflicts:
        warnings.append(
            f"{session_number}회기 ({시작시각}) - 동일 장소에 겹치는 일정이 있습니다: {titles}"
        )
    ...

return CaseWithSessionsResponse(..., warnings=warnings)
```

- 상담은 **회차별 충돌 경고 문자열을 배열로 반환**
- 검사 접수는 이 `warnings` 필드 자체가 없어 응답에서 누락됨

---

## 6. Schedule 응답 DTO (경고 전달용)

**파일**: `apps/api/app/modules/schedule/schemas.py:185-218`

```python
class ScheduleResponse(BaseModel):
    id: str
    center_id: str
    schedule_type: ScheduleType
    room_id: str | None
    start: datetime
    end: datetime
    ...
    has_conflict: bool = False                         # 경고 플래그
    conflicting_schedules: list[ScheduleSummary] = []  # 충돌 일정 요약
```

- 이 DTO는 **직접 schedule을 생성하는 엔드포인트**(`POST /schedules`)에서 사용
- Facade 두 버전 중 `create_schedule_with_response()`가 이걸 조립해 반환
- 접수 엔드포인트에서는 **사용되지 않음** (검사 접수가 충돌 정보를 응답에 못 싣는 이유)

---

## 7. 동시성 제어: `acquire_room_lock`

**파일**: `apps/api/app/modules/schedule/services/create_schedule.py:14-76`

```python
if room_id:
    await self.repo.acquire_room_lock(center_id=center_id, room_id=room_id)
    conflicts = await self.repo.find_conflicting_schedules(...)
```

- 장소 단위의 advisory lock을 잡고 충돌 검사 → 생성
- 여러 요청이 **같은 방에 동시 생성**할 때 race condition 방지
- 하지만 **충돌이 있어도 생성은 진행** — 락은 동시성 문제 해결용, "중복 방지"는 아님

---

## 8. 비교 요약

| 항목 | 검사(Assessment) 접수 | 상담(Counseling) 접수 | 직접 일정 생성 |
|---|---|---|---|
| FE 사전 검증 | `MultiDateSchedulePicker` 경고 | FE 전용 UI 없음 | 동일 picker 사용 |
| 제출 차단 조건 | client/assessment/counselor/(room·schedule) 필수 | — | — |
| 중복 케이스 차단 | ❌ | ✅ 5분 이내 동일 케이스 시 409 | ❌ |
| 장소 충돌 시 차단 | ❌ 생성 진행 | ❌ 생성 진행 | ❌ 생성 진행 |
| 충돌 정보 응답 전달 | ❌ 응답에 없음 | ✅ `warnings[]` | ✅ `has_conflict` + `conflicting_schedules` |
| 상담사(counselor) 충돌 | — | — | — (없음) |

---

## 9. 주목할 엣지 케이스 / 함정

1. **장소(room)가 `null`이면 충돌 검사를 건너뜀**
   `CreateScheduleService.execute`: `if room_id:` 가드 → 장소 미지정 일정은 무조건 통과.

2. **상담사(counselor) 중복은 전혀 체크하지 않음**
   한 상담사에게 같은 시간 두 개 케이스가 배정되어도 경고 없음.

3. **경계값(10:00–11:00 vs 11:00–12:00)은 충돌 아님** (`<`, `>` 사용).

4. **소프트 삭제 / 전체 취소된 일정은 "공간을 점유하지 않음"**
   취소된 예약 위에 그대로 새 예약 가능.

5. **검사 접수는 충돌이 있어도 FE로 정보가 안 돌아옴** — 응답에 `warnings` 필드가 없어 사용자가 무시하고 제출하면 묻힘. 상담 접수는 `warnings[]`로 표시 가능.

6. **시간대 변환**: FE는 `HH:MM` (KST) 로 보내고, `validate-dates` 서비스가 **KST → UTC naive 수동 변환(−9h)**. DB는 UTC naive 저장. 스케줄 생성 경로는 `to_utc_naive()` 유틸 사용.

7. **편집 시 자기 자신 제외**: `exclude_id` / `exclude_schedule_id` 를 넘겨야 "자기 자신과 충돌"로 오판하지 않음.

---

## 10. 파일 인덱스

### Frontend
| 역할 | 경로 |
|---|---|
| 접수 서비스 | `apps/web/src/lib/features/assessment/receive/receive-service.ts` |
| 접수 훅/validation | `apps/web/src/lib/features/assessment/receive/hooks.svelte.ts` |
| 접수 쿼리 빌더 | `apps/web/src/lib/features/assessment/receive/query-builders.ts` |
| 충돌 경고 피커 | `apps/web/src/lib/components/schedule/MultiDateSchedulePicker.svelte` |

### Backend
| 역할 | 경로 |
|---|---|
| 핵심 쿼리 | `apps/api/app/modules/schedule/repository.py` |
| 일정 생성 서비스 | `apps/api/app/modules/schedule/services/create_schedule.py` |
| 다중 날짜 검증 서비스 | `apps/api/app/modules/schedule/services/validate_dates_schedules.py` |
| 다중 날짜 검증 핸들러 | `apps/api/app/modules/schedule/handlers/validate_dates_schedules.py` |
| Schedule Facade | `apps/api/app/modules/schedule/facade/schedule_facade.py` |
| Schedule DTO | `apps/api/app/modules/schedule/schemas.py` |
| 검사 접수 핸들러 | `apps/api/app/application/handlers/assessment/create_individual.py` |
| 상담 접수 핸들러 | `apps/api/app/application/handlers/counseling/create_case_with_sessions.py` |
