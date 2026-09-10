---
paths:
  - "apps/api/app/modules/**/models.py"
  - "apps/api/app/infrastructure/persistence/models.py"
---

# Persistence / Model — 선언 규칙

> 레퍼런스 [center/center/models.py](../../../apps/api/app/modules/center/center/models.py). repo 관계는 [persistence-repository.md](persistence-repository.md)(Entity-free — Model이 도메인 데이터).
> 베이스: 모든 모델은 `BaseModel` 상속 — id·created_at·updated_at·deleted_at 제공.

## 1. 스타일

- 섹션 마커 `# #` / `# model` (클래스 위).
- 클래스명은 도메인 명사 그대로, suffix 없음(`class ActivityLog(BaseModel)`) — 기존 `Schedule`·`Institution`과 동일.
- `mapped_column`은 한 줄(`comment=` 없으니 대부분 짧다). 인자 많으면 한 줄에 하나.
- 그 외 주석·docstring 없음.

## 2. 컬럼

| 대상 | 규칙 |
|---|---|
| audit (id·created_at·updated_at·deleted_at) | BaseModel에서 **상속 — 재선언 금지**. 레퍼런스는 bare base라 재선언하지만 imomtae는 BaseModel이 제공 |
| 멀티테넌시 | tenant-scoped 엔티티는 `center_id: Mapped[str]` (`String(36)`, `index=True`) |
| 타 모듈 참조 id (`owner_member_id` 등) | `String(36)` + `info={"reference_table_name": "<테이블명 복수>"}` — FK 제약 없음(모듈 독립성), 대상은 마커가 계약. 소비처: `infrastructure/persistence/relations.py`·`runtime/agent/mutation/ref_resolver.py`. `center_id`는 예외(TENANT_ID 별도 처리, 마커 불요) |
| enum 성 값 (`status` 등) | DB Enum 안 씀 — 닫힌 값집합은 `str, Enum`(models.py 공존, messaging `MessageType` 선례) + 파라미터 Enum 타이핑(typecheck가 유효값 강제). DB/JSON 저장은 값 그대로. 열린/외부정의 집합만 `String(n)` 유지 |
| DDL `comment=` | 동어반복(컬럼명 재진술)은 **금지 — 제거**. enum 값 목록·비정규화 표시·id 종류 등 컬럼명으로 추론 불가한 **정보성만 허용**(운영도구가 읽는 DB 메타). 판단: "없으면 다음 사람이 잘못 고치나" |

## 3. soft-delete unique — partial index

"삭제 안 된 행 중 유일"은 전역 `unique=True`로 하면 soft-delete된 행과 충돌한다. 항상 partial index로:

```python
# good:
__table_args__ = (
    Index(
        "uq_test_widgets_center_name_active",
        "center_id",
        "name",
        unique=True,
        postgresql_where=text("deleted_at IS NULL"),
    ),
)

# bad:  name = mapped_column(String, unique=True)   → 삭제 후 같은 값 재생성 불가
```

- 유니크 범위는 보통 `center_id` 포함(센터 내 유일 — 타 센터 동명 허용).

## 4. 필드 명명 아키타입

같은 역할은 같은 이름 패턴으로. 값 집합(도메인)은 달라도 이름 패턴은 하나.
(결정 원장·대상 목록: [00-field-archetypes.md](../../loop/archive/convention-design/00-field-archetypes.md) — 종결)

| 역할 | 패턴 | 규칙 |
|---|---|---|
| 참조(도메인 역할) | `{role}_id` + `info={"reference_table_name": "<테이블명>"}` | FK 없음 — 대상은 마커로. 값=실제 테이블명(복수). UI 표시되는 관계(counselor·author·uploader 등)는 표시 대상(members 등) |
| 감사 행위자(누가 했나) | `{verb}_by` + 마커 | 로그인 주체가 이 행을 만들/바꿈. 기준층=인증 주체(`accounts`/`admin_accounts`), nullable(system=null). person/member 저장 금지 |
| 다형 참조 | `{concept}_id` + `{concept}_type` + `info={"reference_type_field": "{concept}_type"}` | 대상 테이블이 종류 판별자로 런타임에 갈릴 때. concept은 도메인명 유지, 접두 일치, 판별자 `_type`. 종류→테이블이 정적이면 `"reference_tables": {"<종류>": "<테이블>"}` 동반(relations.py가 그래프 edge로 추출). 단일 테이블이면 다형 아님(강등) |
| 종류 판별자 | `{noun}_type` | bare `type`·`kind` 금지 |
| 열거형 값 (닫힌 집합) | `str, Enum` (models.py 공존) + 파라미터 Enum 타이핑 | status·type·category·role·priority·channel 등. bare 리터럴·상수클래스 금지. typecheck가 유효값 강제, DB=값. 열린/외부정의 집합은 str 유지(판단) |
| 템플릿 종류 | `template_type` | 값은 도메인별. `default_template_type`=기본값 역할 접두 |
| 상태(파이프라인) | `{aspect}_status` | 값 = `pending`/`processing`/`completed`/`failed`. 도메인 생명주기 status는 자체 어휘 |
| 만료 시각 | `expires_at` | 미래 기한. `expired_at` 금지 |
| 타임스탬프 | `{verb_past}_at` | 접두 네임스페이스 금지(`verification_*_at`), 표준 동사(`accepted_at`) |
| 에러 내용 | `error_message` | `error`·`*_error` 금지 |
| 자유 메모 | `memo` | `note`/`notes` 금지. `note`는 정식 Note 엔티티 전용. 한정 노트는 `{x}_note` |
| 범용 메타백 | `meta` | 잡동사니 부가속성. 목적 있는 구조화 내용은 목적명(`payload`·`data`) |
| 순번/정렬 | `*_number`(업무순번) · `*_index`(0-based 배열) · `sequence`(스트림 순서) · `*_order`(정렬키) | 역할대로 골라 씀 |
| on/off | `is_*` | 상태. 능력=`supports_*`/`can_*`, 채널 토글 그룹=`channel_*` 허용 |
| 구간 경계 | 예정 구간=bare `start`/`end`(또는 `{x}_date`) · 발생 사건=`{verb_past}_at` | 예정된 시간 구간의 경계는 사건이 아니므로 타임스탬프 아키타입(`_at`) 비적용 — 명문화 2026-07-09(리네임 0) |

### 안티패턴

`expired_at` · `kind`/bare `type` · `note`/`notes`(자유메모) · `error`/`*_error` · `membered_at`류 접두 타임스탬프 → 위 표의 패턴으로.
