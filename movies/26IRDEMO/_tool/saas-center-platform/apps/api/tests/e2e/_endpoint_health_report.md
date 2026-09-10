# 엔드포인트 헬스 스윕 결과

- 호출 374: ok=373 server_error=1
- skip 72 (비-center 쓰기 / 파괴적 가드)

## READ 5xx (GET — 명백한 회귀, 하드 게이트)

| status | path | body |
|---|---|---|

## WRITE 계약 갭 (빈-body로 surface — 일괄 결정 대상, 테스트 미실패)

스키마/모델/typecheck 레이어가 필드 필수성을 다르게 말해 빈 body가 422 대신 500이 되는 경우.
어느 레이어가 권위인지는 계약 판단이라 자동 수정하지 않고 기록만 한다.

| status | method | path | body |
|---|---|---|---|
| 503 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/non-operating-times/holidays | {"detail": "INTERNAL_API_SECRET not configured"} |

## SKIPPED (안전 가드)

| method | path | why |
|---|---|---|
| post | /api/v1/app/auth/login | non-center write |
| post | /api/v1/app/auth/refresh | non-center write |
| post | /api/v1/app/auth/signup | non-center write |
| post | /api/v1/app/family/invitations | non-center write |
| post | /api/v1/app/family/join | non-center write |
| delete | /api/v1/app/family/members/me | non-center write |
| delete | /api/v1/app/family/members/{member_id} | non-center write |
| post | /api/v1/app/link-invitations/verify | non-center write |
| post | /api/v1/app/links/claim | non-center write |
| put | /api/v1/app/notification-settings | non-center write |
| patch | /api/v1/app/notifications/read-all | non-center write |
| patch | /api/v1/app/notifications/{notification_id}/read | non-center write |
| post | /api/v1/app/profiles | non-center write |
| patch | /api/v1/app/profiles/{profile_id} | non-center write |
| delete | /api/v1/app/profiles/{profile_id} | non-center write |
| post | /api/v1/app/profiles/{profile_id}/image | non-center write |
| patch | /api/v1/app/profiles/{profile_id}/image | non-center write |
| post | /api/v1/app/profiles/{profile_id}/merge | non-center write |
| post | /api/v1/app/push-tokens | non-center write |
| delete | /api/v1/app/push-tokens | non-center write |
| post | /api/v1/app/records | non-center write |
| patch | /api/v1/app/records/{record_id} | non-center write |
| delete | /api/v1/app/records/{record_id} | non-center write |
| patch | /api/v1/app/records/{record_id}/bookmark | non-center write |
| post | /api/v1/app/records/{record_id}/media/upload-url | non-center write |
| delete | /api/v1/app/records/{record_id}/media/{media_id} | non-center write |
| post | /api/v1/app/records/{record_id}/media/{media_id}/complete | non-center write |
| patch | /api/v1/app/records/{record_id}/profile | non-center write |
| post | /api/v1/app/schedules/{schedule_id}/cancel | non-center write |
| post | /api/v1/app/schedules/{schedule_id}/change-requests | non-center write |
| post | /api/v1/assessment-results/{send_result_id}/verify | non-center write |
| post | /api/v1/assessment-send-links/{send_link_id}/tasks/{task_id}/submit | non-center write |
| post | /api/v1/assessment-send-links/{send_link_id}/verify | non-center write |
| post | /api/v1/auth/change-password | non-center write |
| post | /api/v1/auth/devices/revoke | non-center write |
| post | /api/v1/auth/login | non-center write |
| delete | /api/v1/auth/me | non-center write |
| post | /api/v1/auth/refresh | non-center write |
| post | /api/v1/auth/signup | non-center write |
| post | /api/v1/auth/verify-password | non-center write |
| post | /api/v1/centers/applications/ | non-center write |
| delete | /api/v1/centers/applications/{application_id} | non-center write |
| post | /api/v1/centers/applications/{application_id}/approve | non-center write |
| post | /api/v1/centers/applications/{application_id}/reject | non-center write |
| patch | /api/v1/centers/{center_id} | non-center write |
| patch | /api/v1/centers/{center_id}/center-assessments/batch | center-direct mutate (destructive guard) |
| patch | /api/v1/centers/{center_id}/counseling/sessions/batch-update | center-direct mutate (destructive guard) |
| patch | /api/v1/centers/{center_id}/me/member | center-direct mutate (destructive guard) |
| delete | /api/v1/centers/{center_id}/members/me/leave | center-direct mutate (destructive guard) |
| patch | /api/v1/centers/{center_id}/note-preferences | center-direct mutate (destructive guard) |
| put | /api/v1/centers/{center_id}/notification-settings | center-direct mutate (destructive guard) |
| delete | /api/v1/centers/{center_id}/notifications/push-tokens | center-direct mutate (destructive guard) |
| patch | /api/v1/centers/{center_id}/notifications/read-all | center-direct mutate (destructive guard) |
| put | /api/v1/centers/{center_id}/operating-times/ | center-direct mutate (destructive guard) |
| post | /api/v1/document/share/share/ | non-center write |
| post | /api/v1/document/share/share/validate | non-center write |
| post | /api/v1/institutions/ | non-center write |
| patch | /api/v1/institutions/{institution_id} | non-center write |
| delete | /api/v1/institutions/{institution_id} | non-center write |
| post | /api/v1/persons | non-center write |
| post | /api/v1/persons/me/credentials | non-center write |
| patch | /api/v1/persons/me/credentials/{credential_id} | non-center write |
| delete | /api/v1/persons/me/credentials/{credential_id} | non-center write |
| post | /api/v1/persons/me/credentials/{credential_id}/attachment | non-center write |
| delete | /api/v1/persons/me/credentials/{credential_id}/attachment | non-center write |
| post | /api/v1/persons/me/credentials/{credential_id}/request-verification | non-center write |
| patch | /api/v1/persons/{person_id} | non-center write |
| delete | /api/v1/persons/{person_id} | non-center write |
| post | /api/v1/support/inquiry | non-center write |
| post | /api/v1/upload/images/ | non-center write |
| delete | /api/v1/upload/images/ | non-center write |
| post | /api/v1/webhooks/toss/payment | non-center write |