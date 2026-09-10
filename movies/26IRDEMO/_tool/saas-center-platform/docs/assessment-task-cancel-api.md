# 검사(Task) 취소 API 정리

Case 안의 **개별 검사 = Task** 기준으로 취소 API 존재 여부와 사용 방법을 정리합니다.

---

## 1. 백엔드: Task(검사) 단위 취소 API — **존재함**

| 항목 | 내용 |
|------|------|
| **경로** | `POST /api/v1/centers/{center_id}/tasks/{task_id}/cancel` |
| **Body** | `{ "reason": "취소 사유 (선택)" }` |
| **의미** | 케이스 내 **특정 검사 1개**만 취소 (해당 Task만 `cancelled` 처리) |

- **구현 위치**
  - Router: `apps/api/app/modules/assessment/assessment_task/router.py`  
    `@router.post("/tasks/{task_id}/cancel")`
  - Handler: `assessment_task/handlers/cancel_task.py` → `cancel_task_handler`
  - Service: `assessment_task/services/cancel_task.py` → `CancelTaskService`
  - Facade: `facade/task_facade.py` → `AssessmentTaskFacade.cancel_task(task_id, center_id, reason)`

- **동작**
  - `task_id`: **Task 테이블 PK** (AssessmentTask.id, UUID)
  - `pending` / `in_progress` 만 취소 가능
  - 취소 사유는 `process.cancelled_reason`, `process.cancelled_at` 에 저장
  - Task 취소 후 Case 상태 동기화 (`SyncCaseStatusService`)

---

## 2. 백엔드: Case 전체 취소 API — **존재함**

| 항목 | 내용 |
|------|------|
| **경로** | `POST /api/v1/centers/{center_id}/assessment-cases/{case_id}/cancel` |
| **Body** | `{}` (비어 있음) |
| **의미** | **케이스 전체** 취소 (해당 Case 아래 모든 Task 취소 + Case 상태 `cancelled`) |

- 구현: `application/handlers/assessment/cancel_case.py` → `task_facade.cancel_tasks(...)` 로 일괄 Task 취소 후 Case 취소 처리.

---

## 3. 프론트엔드와의 불일치

- **백엔드 실제 경로**  
  `POST /centers/{center_id}/tasks/{task_id}/cancel`  
  → 경로에 **case_id 없음**, 식별자는 **task_id** 하나.

- **프론트엔드 현재 호출** (`case.action.ts` 의 `cancelTask`)  
  `centers/${centerId}/assessment-cases/${caseId}/tasks/${assessmentId}/cancel`  
  → **case_id + assessment_id** 조합 사용, 경로도 백엔드와 다름.

- **정리**
  - 백엔드는 **task_id**(Task PK)만 받고, **assessment_id**나 case_id를 경로에 쓰지 않음.
  - 프론트에서 “이 검사(Task) 하나만 취소”하려면:
    - **task_id** = `AssessmentItem.id` (view-model 에서 `task.id` 로 매핑된 값)
    - 요청 URL: `centers/${centerId}/tasks/${taskId}/cancel`
    - Body: `{ reason: "..." }` (TaskCancel 스키마와 동일)

---

## 4. 프론트엔드 수정 시 참고

- **개별 검사(Task) 취소**  
  - `cancelTask` 의 URL을  
    `centers/${centerId}/tasks/${taskId}/cancel`  
    로 변경.
  - 인자: `centerId`, **taskId** (= `selectedAssessment.id`), `payload: { reason }`.
  - `assessmentId` / `caseId` 는 이 API 경로에는 불필요.

- **케이스 전체 취소**  
  - 기존처럼 `cancelCase(caseId)` 유지  
  - 경로: `centers/${centerId}/assessment-cases/${caseId}/cancel`.

이렇게 구분하면 “Case 안의 검사 = Task” 단위 취소 API가 존재하고, 그 API와 프론트 호출이 일치하게 됩니다.
