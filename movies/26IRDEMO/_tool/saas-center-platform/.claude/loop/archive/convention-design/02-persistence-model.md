# 계층 2 — Persistence Model 설계 `[설계완료]`

정본 rule: [persistence-model.md](../../rules/api/persistence-model.md). 상위 인덱스: [convention-design.md](../convention-design.md).

전 모듈 `models.py` survey 완료. 이미 통일된 축(FK 0·DB Enum 0·audit 재선언 0·comment= M2 keeper·bare unique M1 keeper)은 무변경. 아래만 설계 대상.

## 2-A. enum형 값 저장 방식 = `str, Enum` (전역) — `[확정: 2026-07-02]`

같은 "enum성 String" 값의 도메인이 세 방식으로 흩어져 있었음:

| 방식 | 예 | 모듈 |
|------|-----|------|
| bare 문자열 리터럴 | `default="none"` | field_note · person/credential · ai_lab |
| `{Model}Status` 상수 클래스(+`ALL`) | `FormExtractionStatus.STARTED` | form/extraction · voucher/extraction |
| `str, Enum` | `class MessageStatus(str, Enum)` | messaging |

**결정(사용자): 셋 다 → `str, Enum`. status뿐 아니라 모든 enum형 필드에 적용**(type·kind·category·role·priority·channel·method·provider 등 닫힌 값 집합). 상수 클래스(FormExtractionStatus 등)·bare 리터럴 전부 `str, Enum`으로.
- **계약**(③에서 확정, 전 Enum 공통): models.py 공존 · repo/service 파라미터 **Enum 타이핑**(typecheck가 유효값 강제) · DB/JSON=값 문자열 · 호출처 멤버화.
- **경계 — 닫힌 집합만.** 자주 늘거나 외부정의 값(`source_type`류·⑭ 다형참조 판별자=참조 가능 테이블들)은 **필드별 판단**(열려 있으면 str 유지). 새 값마다 코드 변경이 부담되면 str.
- 리플: repo/service 비교(`== "completed"`)·schema·Response 타입이 Enum으로 상향. **값 자체는 대부분 유지(비파괴)**, 단 ③ 파이프라인은 값도 바뀜(파괴). 호출처 멤버화는 파괴적(마이그 아님, 코드).
- **DTO 소유(예외 sweep 2026-07-04)**: 2-A Enum이 request/response DTO 필드(`status: str`→`status: FieldNoteStatus`)에도 닿는데, 계층 1(Schema)은 생략돼 **소비처(router/handler)가 DTO를 소유**([schema.md](../../rules/api/schema.md)는 위생만 다룸). → DTO Enum 타이핑은 **미결이 아니라 소비처 계층 작업**(계층 1 흡수 결정의 귀결). str-Enum이라 직렬화는 무변경.

## 2-B. 상태 어휘(vocabulary) — `[확정: 사용자 2026-07-03 — (A) 완전 통일]` · 파괴적(마이그+프론트)

같은 의미를 다른 단어로. field_note는 한 파일 안에서도 갈림:

| 의미 | 쓰이는 단어 | 정리안(제안) |
|------|------------|-------------|
| 미시작 | `none`·`pending`·`idle` | `pending` |
| 진행중 | `processing`·`generating`·`started` | `processing` |
| 완료 | `completed` (일관) | `completed` |
| 실패 | `failed` (일관) | `failed` |

- 근거: [field_note/models.py:36-54](../../../apps/api/app/modules/field_note/field_note/models.py#L36-L54) — `transcribe_status="pending"` vs `refine/…="none"` vs `processing_status="idle"`, `summary_status`만 진행중을 `generating`.
- **파괴적** — DB 저장 문자열 변경이라 alembic 데이터 마이그 + 프론트 status 분기 동반. 2-A(Enum 도입, 비파괴) 완료 후 별건.
- **결정(사용자 2026-07-03): (A) 완전 통일 — 값까지 변경.** 이름/Enum(비파괴)만이 아니라 저장값 `none`/`idle`→`pending`, `generating`/`started`→`processing` 실제 치환까지. 실행 = 00-③ 매핑 그대로. **집행 = 별도 파괴 슬라이스**(alembic 데이터 마이그 + 프론트 status 분기 동반). Enum 멤버도 4지(`PENDING`/`PROCESSING`/`COMPLETED`/`FAILED`)로 깔끔해짐.

## 2-C. Index 이름 접두 — `[설계완료]`

- divergence: `idx_*`(field_note) vs `ix_*`(extraction류) vs 테이블명 누락([messaging/models.py:46-48](../../../apps/api/app/modules/messaging/messaging/models.py#L46-L48) `idx_center_status`).
- canonical: `ix_{table}_{cols}` (SQLAlchemy 기본 접두 `ix_` + 테이블명 필수). 테이블명 누락은 충돌 위험이라 반드시 정정.
- before→after:
```python
# before (messaging) — 테이블명 없음, 충돌 위험
Index("idx_center_status", "center_id", "status")
# after
Index("ix_message_logs_center_status", "center_id", "status")
```
- 리플: 인덱스 이름은 코드 참조 없음(문자열). 단 **이름 변경 = alembic 마이그**(rename index) 동반 → 파괴적은 아니나 마이그 필요. 접두만 통일할지, 마이그 비용 감안해 신규만 규약 적용할지 실행 phase에서 판단.

## 2-E. `DateTime` 표기 — `[설계완료]`

- divergence: `DateTime(timezone=False)` 명시(extraction·messaging) vs bare `DateTime`(field_note·person/credential).
- canonical: bare `DateTime` (프로젝트가 naive UTC 저장 전제 — `timezone=False`가 기본값이라 명시는 잉여).
- before→after: `DateTime(timezone=False)` → `DateTime`. 비파괴(DDL 동일).

## 2-F. mapped_column 줄바꿈 — `[설계완료]`

- divergence: 긴 인자를 한 줄에 욱여넣음([voucher_extraction/models.py:25](../../../apps/api/app/modules/voucher/voucher_extraction/models.py#L25)) vs 여러 줄(field_note).
- canonical: rule §1 — 한 줄 기본, 인자 많아 길면 한 줄에 하나. 100자 초과 시 개행.
- 순수 포맷팅, 비파괴.
