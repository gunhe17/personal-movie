# 쓰기-발행 emit 배선 검증 결과

- probe 28: ok=28 emit_wiring_5xx=0 harness=0

## EMIT 배선 5xx (명백 회귀 — 권장: 라우트에 start_event_group()+dispatch_events() 배선)

| status | method | path | event | body |
|---|---|---|---|---|

## UNREACHED 4xx (emit 도달 전 차단 — 권한/검증, 회귀 아님)

| status | method | path | event | body |
|---|---|---|---|---|

## OK (2xx — emit 통과 확인)

| status | method | path | event |
|---|---|---|---|
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/rooms/ | room_created |
| 200 | PATCH | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/rooms/5f90d0b2-3f7d-466d-9a81-6c7c70a4d2bd | room_updated |
| 204 | DELETE | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/rooms/5f90d0b2-3f7d-466d-9a81-6c7c70a4d2bd | room_deleted |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/members/invitations | member_invitation_created |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/members/443ce9de-99b6-46ab-81cc-b70a42f581f9/non-working-times/ | member_non_working_time_created |
| 200 | PATCH | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/members/443ce9de-99b6-46ab-81cc-b70a42f581f9/non-working-times/e578e4cb-1738-4c11-8f8f-d17483310c04 | member_non_working_time_updated |
| 204 | DELETE | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/members/443ce9de-99b6-46ab-81cc-b70a42f581f9/non-working-times/e578e4cb-1738-4c11-8f8f-d17483310c04 | member_non_working_time_deleted |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/non-operating-times/ | center_non_operating_time_created |
| 200 | PATCH | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/non-operating-times/2d1bd8be-1cd6-4630-b7e2-8d733f6d7237 | center_non_operating_time_updated |
| 204 | DELETE | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/non-operating-times/2d1bd8be-1cd6-4630-b7e2-8d733f6d7237 | center_non_operating_time_deleted |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/roles/ | role_created |
| 200 | PATCH | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/roles/C61EE750 | role_updated |
| 204 | DELETE | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/roles/C61EE750 | role_deleted |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/message-templates/ | message_template_created |
| 200 | PATCH | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/message-templates/d2a9afb4-96a7-4bcf-b7bd-29b192effce0 | message_template_updated |
| 200 | DELETE | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/message-templates/d2a9afb4-96a7-4bcf-b7bd-29b192effce0 | message_template_deleted |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/forms/templates/ | form_template_created |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/price-lists/ | price_list_created |
| 200 | PATCH | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/price-lists/785025e5-b898-4f1f-958e-a06ba185c43c | price_list_updated |
| 200 | DELETE | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/price-lists/785025e5-b898-4f1f-958e-a06ba185c43c | price_list_deleted |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/assessment-sets | assessment_set_created |
| 200 | PATCH | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/assessment-sets/b3cefb12-1507-4358-8f48-ba9fb1768f16 | assessment_set_updated |
| 200 | DELETE | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/assessment-sets/b3cefb12-1507-4358-8f48-ba9fb1768f16 | assessment_set_deleted |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/assessment-packages | assessment_package_created |
| 200 | PATCH | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/assessment-packages/b6d0e81b-1283-471b-80c9-ad824bd06f88 | assessment_package_updated |
| 200 | DELETE | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/assessment-packages/b6d0e81b-1283-471b-80c9-ad824bd06f88 | assessment_package_deleted |
| 200 | PATCH | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/center-assessments/batch | center_assessment_updated |
| 201 | POST | /api/v1/centers/65004945-6994-47e4-9352-9f722dee8ac2/counseling/sessions/59b24d42-764f-414a-936f-7778351ae464/notes | counseling_note_created |

## HARNESS (조립 실패 — payload/픽스처)
