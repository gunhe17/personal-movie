# 공지 미열람자 알림 발송 기획

## 개요

어드민에서 공지사항을 작성한 뒤, 아직 읽지 않은 멤버에게 리마인드 알림을 발송하는 기능.

> 공지 발행(publish) 시 전체 멤버에게 최초 알림이 발송됨. 이 기능은 그 이후에도 읽지 않은 멤버를 대상으로 **리마인드 알림**을 보내는 것.

---

## 발송 대상 범위

- **일괄 발송**: 모든 센터의 미열람 멤버 전체에게 리마인드 알림
- **개별 발송**: 특정 센터의 미열람 멤버에게 리마인드 알림

> "미열람 멤버" = `notice_reads` 테이블에 `(notice_id, member_id)` 레코드가 없는 멤버

---

## 알림 채널

| 채널 | 설명 | 비고 |
| ---- | ---- | ---- |
| 인앱 알림 | `notifications` 테이블에 레코드 생성 | 기본 |
| FCM Push | 모바일/웹 푸시 알림 | 기존 `FirebaseService` 활용 |

> AlarmTalk, SMS, 이메일은 범위 밖.

---

## 재발송 제한 (24시간)

같은 공지에 대해 **24시간 내 중복 발송 불가** (일괄/개별 통합).

### 구현 방식

- **DB 변경 없음** — 기존 `audit_logs` 테이블 활용
- 발송 시 audit log에 `action="notice.notify_remind"`, `target_id=notice_id`로 기록 (기존 체크리스트 준수)
- 쿨다운 검증: `audit_logs`에서 `action IN ('notice.notify_remind', 'notice.notify_remind_center') AND target_id=notice_id` 최신 1건의 `created_at` 조회
- 24시간 이내면 `409 Conflict` 반환

### 프론트엔드 처리

- 24시간 이내 발송 이력이 있으면 버튼 비활성화 + "N시간 후 재발송 가능" 툴팁
- 쿨다운 정보는 읽음 현황 API 응답에 `last_notified_at` (audit_logs 조회 결과) 포함

---

## 중복 알림 방지 (event_ref)

발행 알림과 리마인드 알림은 별도 `event_type`으로 구분:

| 시점 | event_type | event_ref_prefix | 비고 |
| ---- | ---------- | ---------------- | ---- |
| 공지 발행 시 | `notice_published` | `notice_published:{notice_id}` | 기존 |
| 리마인드 발송 시 | `notice_remind` | `notice_remind:{notice_id}` | 신규 |

> `event_ref`가 다르므로 동일 멤버에게 발행 알림 + 리마인드 알림 둘 다 도달 가능 (의도된 동작).
> 같은 `notice_remind` 내에서는 `event_ref`로 중복 방지.

---

## API 설계

### 1. 일괄 발송 (미열람 멤버 전체)

```
POST /admin/notices/{notice_id}/notify
```

**Request Body**: 없음 (미열람 전체 대상)

**처리 흐름**:
1. `audit_logs` 기반 24시간 쿨다운 검증
2. `notice_reads` 기반으로 미열람 멤버 수 집계
3. Audit Log 기록 (`notice.notify_remind`)
4. `BackgroundTasks`로 알림 발송 위임 (독립 세션)
5. 즉시 202 응답 반환

**Response** (202):
```json
{
  "message": "알림 발송이 시작되었습니다.",
  "target_member_count": 23
}
```

**Error** (409 - 24시간 이내 재발송):
```json
{
  "detail": "마지막 발송 후 24시간이 지나지 않았습니다. N시간 후 재발송 가능합니다."
}
```

### 2. 개별 센터 발송

```
POST /admin/notices/{notice_id}/notify/{center_id}
```

**Request Body**: 없음

**처리 흐름**:
1. `audit_logs` 기반 24시간 쿨다운 검증 (일괄/개별 통합)
2. 해당 센터의 미열람 멤버 목록 조회
3. Audit Log 기록 (`notice.notify_remind_center`)
4. `BackgroundTasks`로 알림 발송 위임 (독립 세션)
5. 즉시 202 응답 반환

**Response** (202):
```json
{
  "message": "알림 발송이 시작되었습니다.",
  "target_member_count": 4
}
```

---

## 백엔드 구현 계획

### 파일 구조

```
apps/api/app/modules/platform_admin/notice/
├── handlers/
│   └── notify_notice.py          # 알림 발송 핸들러 + BackgroundTask 함수
├── services/
│   └── notify_unread_members.py  # 미열람 멤버 조회 + 24시간 검증
└── router.py                     # 엔드포인트 추가
```

### DB 변경

없음. 쿨다운 검증은 기존 `audit_logs` 테이블을 활용.

### Repository 추가 메서드

```python
# platform_admin NoticeRepository에 추가
async def get_unread_member_ids_all(self, notice_id: str) -> list[tuple[str, str]]:
    """모든 센터의 미열람 멤버 (center_id, member_id) 목록"""

async def get_unread_member_ids_by_center(self, notice_id: str, center_id: str) -> list[str]:
    """특정 센터의 미열람 멤버 ID 목록"""
```

### Service

```python
class NotifyUnreadMembersService:
    """미열람 멤버 조회 + 24시간 제한 검증"""

    async def validate_cooldown(self, notice_id: str, audit_log_repo) -> None:
        """audit_logs에서 마지막 발송 시각 조회 → 24시간 이내면 ConflictException"""
        # WHERE action IN ('notice.notify_remind', 'notice.notify_remind_center')
        #   AND target_id = notice_id
        # ORDER BY created_at DESC LIMIT 1

    async def get_unread_count(self, notice_id: str, center_id: str | None = None) -> int:
        """미열람 멤버 수 반환"""
```

### Handler + BackgroundTask 패턴

```python
async def notify_unread_handler(
    notice_id: str,
    uow: UnitOfWork,
    background_tasks: BackgroundTasks,
    audit: AuditLogger,
) -> NotifyResponse:
    async with uow:
        # 1. audit_logs에서 24시간 쿨다운 검증
        # 2. 미열람 멤버 수 집계
        # 3. audit.log(action="notice.notify_remind", ...)
        # 4. uow.commit()

    # 5. BackgroundTask로 실제 발송 위임
    background_tasks.add_task(_dispatch_remind_notifications, notice_id, notice_title)
    return NotifyResponse(...)


async def _dispatch_remind_notifications(notice_id: str, notice_title: str) -> None:
    """독립 세션으로 미열람 멤버에게 알림 발송 (BackgroundTask)"""
    async with AsyncSessionLocal() as session:
        # 기존 _dispatch_notice_notifications 패턴과 동일
        # 단, 전체 멤버가 아닌 미열람 멤버만 대상
        # event_type="notice_remind"
        # event_ref_prefix="notice_remind:{notice_id}"
```

> BackgroundTask는 Handler의 UoW 세션이 이미 닫힌 후 실행되므로, `AsyncSessionLocal()`로 독립 세션을 생성해야 함. 기존 `update_notice.py`의 `_dispatch_notice_notifications` 패턴을 그대로 따름.

### 기존 인프라 활용

- `NotificationFacade.notify_bulk()`: 인앱 알림 레코드 생성
- `FirebaseService`: FCM Push 발송
- `BackgroundTasks` + `AsyncSessionLocal()`: 비동기 발송 (독립 세션)

### Audit Log

| action | target_type | summary |
| ------ | ----------- | ------- |
| `notice.notify_remind` | `notice` | `"공지사항 미열람자 리마인드 알림 발송"` |
| `notice.notify_remind_center` | `notice` | `"공지사항 미열람자 리마인드 알림 발송 (센터: {center_name})"` |

---

## 프론트엔드 구현 계획

### 읽음 현황 페이지에서 발송

공지 상세 → 읽음 현황 탭에서 알림 발송 버튼 노출.

| 위치 | 버튼 | 동작 |
| ---- | ---- | ---- |
| 읽음 현황 상단 | "미열람자 일괄 알림" | `POST /notify` 호출 |
| 센터별 행 | "알림 발송" (미열람 멤버가 있는 센터만) | `POST /notify/{center_id}` 호출 |

### 버튼 비활성화 조건

- 전체 멤버가 열람 완료 → 비활성화 ("모두 열람 완료")
- `last_notified_at` (audit_logs 기반)이 24시간 이내 → 비활성화 ("N시간 후 재발송 가능")

### Action 추가

```typescript
// notice.action.ts
export const postNotifyUnread = (): Action<NotifyResponse> => ({
  key: ['postNotifyUnread'],
  request: async (params: { noticeId: string; centerId?: string }) => {
    const url = params.centerId
      ? `/admin/notices/${params.noticeId}/notify/${params.centerId}`
      : `/admin/notices/${params.noticeId}/notify`
    return post(url)
  }
})
```

### UX

- 발송 전 확인 모달: "미열람 멤버에게 리마인드 알림을 발송하시겠습니까?"
- 발송 후 스낵바: "알림 발송이 시작되었습니다."
- 24시간 제한 시: 스낵바 에러 "마지막 발송 후 24시간이 지나지 않았습니다."

---

## 참고

- 읽음 현황 API: `GET /admin/notices/{notice_id}/read-status`
- 센터별 읽음 상세: `GET /admin/notices/{notice_id}/read-status/{center_id}`
- 기존 발행 알림: `apps/api/app/modules/platform_admin/notice/handlers/update_notice.py`
- 알림 헬퍼: `app/modules/notification/helpers.py` → `notify_members()`
- 알림 Facade: `app/modules/notification/facade.py` → `notify_bulk()`
