# 청구서 발행 알림 플랜

> 청구서가 `issued` 상태로 전환될 때 내담자에게 자동으로 알림을 발송한다.

---

## 배경

- 현재는 청구서를 발행해도 내담자가 알 방법이 없음
- 운영자가 별도로 연락하는 수고 발생
- 납부 지연 요인 중 하나가 "발행 사실 자체를 모름"

---

## 현황 조사 결과

| 항목 | 상태 |
|---|---|
| 알림 모듈 | `NotificationFacade` 존재 (`app/modules/notification/facade/notification_facade.py`) |
| 멤버 대상 채널 | 인앱 / 알림톡 / 푸시 |
| **내담자 대상 채널** | SMS / 알림톡 (헬퍼: `resolve_client_sms_targets` + `send_sms_to_client`) |
| 기존 패턴 | 상담 세션 상태 변경 시 member에게 알림 발송 (`counseling_session/handlers/update_session.py`) |
| 발송 방식 | FastAPI BackgroundTasks (Celery 미사용) |

### 핵심 제약
- 알림 시스템의 기본 대상은 **센터 멤버(account_id)**
- 내담자에게 직접 보내려면 **SMS/알림톡 헬퍼**를 사용해야 함 (이미 구현되어 있음)

---

## 제안 설계

### 트리거 지점
**파일**: `apps/api/app/modules/billing/billable/handlers/update_billable_status.py`

상태가 `issued`로 전환될 때만 알림 발송.

### 흐름
```
1. [트랜잭션 내]
   - facade.update_status_with_response(...)
   - new_status == "issued" 이면:
     - Billable 조회 (client_id, total_amount, due_date)
     - resolve_client_sms_targets(uow, [client_id], message)

2. await uow.commit()

3. [트랜잭션 외 — BackgroundTasks]
   - background_tasks.add_task(send_sms_to_client, target)
```

### 메시지 템플릿 (초안)
```
[{센터명}]
청구서가 발행되었습니다.
금액: {total_amount}원
납부기한: {due_date}

자세히 보기: {링크}
```

---

## 결정 필요한 항목

> 답변은 각 항목 아래 `**답**:` 줄에 적어주세요.

### 1. 메시지 문구
- 위 템플릿처럼 **금액 + 납부기한** 간단하게?
- 결제 링크(토스페이먼츠 등) 포함?
- 센터 이름 prefix 필수?

**답**: 일단 그대로 가자! 나중에 pg 결제 생기면 그거 붙이는 방식으로 진행하자

---

### 2. 아동 내담자의 경우 수신자
- `child_client` (아동, 보호자 있음) → 보호자에게 발송
- `adult_client` → 본인에게 발송
- `role="both"` (내담자+보호자 역할 동시) → 본인? 보호자? 둘 다?

**추천**: child_client면 **is_primary=true 보호자**, adult_client면 본인, both면 본인만

**답**: 추천으로 ㄱㄱ

---

### 3. 연락처가 없는 내담자
- 조용히 스킵 + 서버 로그만
- 발행 자체를 막고 에러 반환
- 발행은 되고 UI에 "알림 발송 실패" 토스트

**추천**: **조용히 스킵 + 서버 로그** (발행은 관리 행위라 알림 실패로 막으면 안 됨)

**답**: 추천으로 ㄱㄱ

---

### 4. 중복 발송 방지
- `issued → issued` 전환은 이미 상태 체크에서 막힐 것으로 예상 → 자연스럽게 방지됨
- 만약 재발송이 필요한 기능이 별도로 필요한가? (예: "다시 알림 보내기" 버튼)

**답**: 수동 재발송 버튼은 넣지말자 너무 남용될수있어

---

### 5. 발행 시 알림 on/off 제어
- 무조건 자동 발송
- 발행 버튼 옆에 **체크박스(기본 ON)** 로 옵션 제공
- 센터 설정에서 "청구 알림 자동 발송" 토글

**추천**: **체크박스(기본 ON)**  
- 이유: 운영 상황에 따라(예: 테스트용 청구서) 끄고 싶은 경우 있음. 센터 설정까지는 과함.

**답**: 추천으로 ㄱㄱ

---

### 6. 기타 고려사항
- 알림톡 템플릿 사전 등록 필요? (한국 알림톡은 사전 승인 필수)
- 발송 기록을 Billable에 남길지 (예: `notification_sent_at` 컬럼)?
- 환불/결제취소 시에도 알림 보낼지? (Phase 4 바우처/환불에서 다룰 예정)

**답**: 알림 템플릿은 보내놓을게 일단 notification sent at 을 남기고 refund는 phase4때 다루자

---

## 구현 범위 (결정 후 확정)

- [ ] `update_billable_status_handler` 수정 — `issued` 전환 시 알림 발송
- [ ] 메시지 템플릿 상수/빌더 함수 작성
- [ ] 수신자 해결 로직 (아동/성인/보호자 분기)
- [ ] BackgroundTasks 의존성 주입 (Router 수정)
- [ ] (옵션) 프론트 발행 버튼에 "알림 발송" 체크박스 추가
- [ ] (옵션) `Billable.notification_sent_at` 컬럼 + 마이그레이션
- [ ] 테스트: 아동/성인 케이스, 연락처 없는 케이스

---

## 관련 파일

- `apps/api/app/modules/billing/billable/handlers/update_billable_status.py` — 수정 대상
- `apps/api/app/modules/billing/billable/router.py` — BackgroundTasks 주입
- `apps/api/app/modules/notification/helpers.py` — 재사용 헬퍼
- `apps/api/app/modules/counseling/counseling_session/handlers/update_session.py` — 기존 패턴 참고
- `apps/web/src/routes/(protected)/billing/components/BillableDetailModal.svelte` — 발행 버튼 위치
