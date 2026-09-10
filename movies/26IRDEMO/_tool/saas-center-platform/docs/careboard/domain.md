# 케어보드 도메인 설계 v1.0

> 웹 SaaS(직원용) 내담자 상세 우측 도크 — 한 내담자에게 일어난 일과 담당자들이 남긴 메모를 한 시간축으로 읽고, 그 자리에서 메모를 남긴다.
>
> 작성일 2026-09-02 · 상태: **설계 확정, 구현 미착수**
> v0.1(2026-01-28) 대체 — 원문 [archive/2026-01-28-domain-v0.1.md](archive/2026-01-28-domain-v0.1.md), 차이는 [§13](#13-v01에서-바뀐-것).
> 결정 근거: [decision-log.md](decision-log.md)
>
> ⚠️ 이름이 같은 다른 문서: [`docs/client-app/케어보드-아키텍처-v1.md`](../client-app/케어보드-아키텍처-v1.md)는 **내담자앱(마인드스코프) 보호자용** 케어보드다. 이 문서와 무관하다.

---

## 0. 한 줄

케어보드는 **"이 내담자에게 지금까지 무슨 일이 있었나"** 를 한 흐름으로 읽는 화면이다.

축이 내담자이지 담당자가 아니다. 그래서 **인수인계**가 성립한다 — 담당이 바뀌어도 이전 상담사가 남긴 회기 요약·검사 소견·메모가 같은 시간축에 그대로 있다. 이 성질이 설계 전반(스코프·저장 형태·삭제 정책)을 지배한다.

---

## 1. 지금 상태

**Phase 1~2 구현 완료** — 스트림·메모·핀·읽음이 서버에 붙어 있다. 남은 목업은 차트 모달 하나.

- 서버 — `modules/care_board/`(entry·memo·read 3테이블, 마이그레이션 `f0f93dcbdcdc`) ·
  `application/handlers/care_board/`(스트림 조회·재구축·반응 동기화·메모/핀/읽음 쓰기) ·
  백필 `scripts/backfill_care_board.py`
- 반응 — 원천 이벤트 18종이 `sync_care_board` → `rebuild_care_board`로 모인다(§6-1).
  재구축은 upsert + **뒷정리**(§9-2)라 멱등이다
- 웹 — `CareBoardDock.svelte`(표현) ← `features/clients/detail/care-board/`(서비스·뷰모델)
  ← `hooks/actions/care-board.action.ts`. 스트림은 커서 무한 스크롤(위로 이어 붙임)
- 아직 목업 — 차트 모달의 `CHART` 리터럴(Phase 3), AI 요약(Phase 4)

---

## 2. 화면 계약

```
┌ 도크(기본) ─ 타임라인 ────────────────┐   "언제 무슨 일이 있었나"
│  고정(핀) 오버레이                      │   시간순 스트림, 훑어 내려감
│  필터: 전체·메모·상담·검사·기타          │
│  스트림 행 + 하단 메모 입력창            │
└─────────────────────────────────────┘
        헤더 [차트] 버튼 → 모달           "이 사람이 어떤 상태인가"
        ① 신원 ② 기본정보 ③ AI 요약 ④ 상담|검사   고정 슬롯, 찍어 읽음
```

- **스트림 두 종류** — 사람이 쓴 것(메모: 아바타+이름+시각) / 시스템이 남긴 것(회기·검사·문서·바우처: 종류 배지+제목). 아바타 유무가 곧 구분이다.
- **행 클릭 = 원본으로** — 상담 상세·검사 상세·문서 미리보기.
- **차트는 모달로 둔다** — 여는 계기(배정·인계·종결 판단)가 저빈도 고가치라 상시 자리를 차지하면 안 된다.

### 2-1. 자리와 뜻 (2026-09-03 정리)

| 자리 | 뜻 | 규칙 |
|---|---|---|
| 행 우측 슬롯 | **고정 토글 하나만** | 한 자리에 이동(`>`)과 고정(핀)을 번갈아 넣지 않는다 — 두 뜻이 겹치면 무엇을 누르는 자리인지 정해지지 않는다 |
| 행 호버 면 | "이 행은 열린다" | 목적지가 있는 행에만 깔린다. 문서·바우처·삭제된 원본은 면이 안 뜬다 |
| 고정된 행 | 공지에 올라간 것 | `primary-50` 면 + `primary-200` 인셋 링. 공지 카드(`primary-100/50`)보다 **한 단계 옅게** — 카드가 결론, 행이 출처 |
| 압정 아이콘 | 전 자리 동일 글리프 | 공지 24 · 행 20, 같은 Figma 정본. 미고정은 그레이톤(색의 유무가 곧 고정 여부) |

- **공지 카드는 스트림 행과 같은 형식으로 그린다** — 기록 행이면 배지·제목·회차를 그대로 세우고 눌러서 원본으로 간다. 본문만 평문으로 뽑으면 "무엇을 고정한 것인지"가 사라진다(메모는 본문이 곧 전부).
- **전환은 부드럽게** — 필터를 바꾸면 이전 목록을 든 채 흐려졌다가 교체되고(빈 프레임 없음), 새로 들어온 행만 6px 페이드로 올라온다. 등장 전환은 **들어올 때만** 건다 — 나갈 때도 걸면 사라지는 동안 행이 DOM에 남아 스크롤 높이가 흔들려 "위로 이어 붙이기"의 위치 보정이 어긋난다.

---

## 3. 데이터 출처 판정

| 스트림 항목 | 원천 | 상태 |
|---|---|---|
| 상담 케이스 개설 | `counseling_cases` | ✅ `list_counseling_cases(client_id=)` |
| 상담 회기 + 요약 | `counseling_sessions` + `counseling_notes.summary`(1000자) | ✅ |
| 검사 실시/소견 | `assessment_tasks(.opinion)` | ✅ |
| 문서 업로드 | `documents` + `client_resources` | ✅ |
| 필드노트 | `field_notes` | ⚠️ client 직결 컬럼 없음 — `schedule_id`뿐(회기→케이스→참여자 3홉). **쓰기 시점엔 맥락을 알므로 프로젝션이 이 역산을 없앤다** |
| 바우처 차감 | `billable_items`(`client_voucher_id`·`quantity`) + `client_voucher updated` atomic | ✅ §9-3 |
| 공유 메모 | — | ❌ 신설(`care_memos`) |
| 핀 / 읽음 | — | ❌ 신설 |

차트:

| 블록 | 원천 | 상태 |
|---|---|---|
| ① 신원 | client | ✅ 이미 실데이터 |
| ② 주호소 | `counseling_cases.chief_complaint` | ⚠️ 케이스별 — 복수 케이스 시 표기 규칙 미정(§14) |
| ③ AI 요약 | — | ❌ 신설 + LLM(§10) |
| ④ 상담 행 | `counseling_notes.summary` | ✅ 절삭만 |
| ④ 검사 행 | `assessment_tasks.opinion` | ✅ 절삭만(§9-1) |

---

## 4. 핵심 결정 — 전용 테이블(참조 + 표시 스냅샷)

읽기 시점에 6개 원천을 fan-out하지 않는다. **`care_board_entries`가 시간축을 소유하고, 각 행이 원본을 참조하면서 표시값 스냅샷을 함께 든다.**

**전용 테이블이 필요한 이유** (fan-out으로 안 되는 것):

1. **커서 페이지네이션.** 채팅형 위로 무한 스크롤인데, 6소스 병합 커서는 소스별 커서를 들고 다니거나 시간 윈도우로 over-fetch해야 한다. 잘린 집합을 재병합하다 조용히 빠지는 건 이 레포가 아는 함정이다(절삭-선행 금지).
2. **핫패스.** 도크가 내담자 상세 진입 시 자동으로 펼쳐진다. 상세 열 때마다 6왕복 + 필드노트 3홉 역산이 붙는다.
3. **보드 고유 상태를 붙일 자리.** 회기·검사 행도 `pinned`를 갖는다. 원본 테이블에 심을 수 없다.

**표시값을 스냅샷으로 함께 드는 이유:**

1. **읽기가 1쿼리가 된다.** 참조만 들면 30행 한 페이지에 kind별 `IN` 6번 + 표시명 해소 3~4번이 붙는다.
2. **원본이 사라져도 이력이 남는다.** 케이스가 종결되고 회기가 취소돼도 "8월에 이런 일이 있었다"는 남아야 인계받은 상담사가 맥락을 읽는다. **케어보드는 살아있는 데이터의 뷰가 아니라 기록이다.**

스냅샷의 고질병(복사한 텍스트가 낡음)은 여기서 성립하지 않는다 — 6개 원천 전부에 `updated` atomic이 이미 emit되고 있어(회기 7 · 검사 7 · 필드노트 5 · 문서 4 · 케이스 2 · 바우처 2) 생성 반응을 다는 김에 갱신 반응이 같이 붙는다. 선례: `counseling_cases.participant_snapshot`.

---

## 5. 스키마

위치: `apps/api/app/modules/care_board/` (신규 모듈). 메모의 소유 엔티티가 내담자라 counseling 아래 두면 케이스 없는 내담자에 메모를 못 단다.

레포 규약: `BaseModel` 상속(id·created_at·updated_at·deleted_at) · `String(36)` · **FK 제약 없음** · 참조는 `info={"reference_table_name": ...}` 마커.

### 5-1. `care_board_entries` — 시간축

```python
class CareBoardEntry(BaseModel):
    __tablename__ = "care_board_entries"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    source_table: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_type_field": "source_table"})
    case_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})

    # 센터 간 인계(§16) — 지금은 쓰지 않으나 나중에 넣으면 전량 백필이라 처음부터 채운다
    person_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "persons"})
    share_class: Mapped[str] = mapped_column(String(20), nullable=False)

    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    subtitle: Mapped[str | None] = mapped_column(String(50), nullable=True)
    body: Mapped[str | None] = mapped_column(String(300), nullable=True)
    meta: Mapped[str | None] = mapped_column(String(200), nullable=True)

    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pinned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    pinned_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    source_deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_care_board_entries_client_time", "center_id", "client_id", "occurred_at"),
        Index(
            "uq_care_board_entries_source",
            "source_table", "source_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
```

- `kind` — `counseling` · `assessment` · `fieldnote` · `document` · `voucher` · `memo` · `handover`
- `person_id` — 전역 신원(`clients.person_id`). 앱 미연결 내담자는 null
- `share_class` — `fact` | `clinical` | `internal`. 메모·필드노트는 무조건 `internal`(§16)
- `occurred_at` = 사건 발생 시각(정렬·커서 키). `created_at`(기록 시각)과 분리 — v0.1에서 이어받은 결정
- `source_table`/`source_id` — 행 클릭 시 원본 이동 + 갱신·재구축 키
- `actor_id` — **표시용이지 필터가 아니다**(§7)
- `title`/`subtitle`/`body`/`meta` — 표시 스냅샷. 원본 수정 시 반응이 갱신
- `pinned_*` — 보드 공용 상태
- `source_deleted_at` — 원본이 사라져도 행은 남는다(§9-2)
- partial unique = **멱등 재구축의 근거**(§6)

### 5-2. `care_memos` — 메모 본문

```python
class CareMemo(BaseModel):
    __tablename__ = "care_memos"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    author_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "members"})
    body: Mapped[str] = mapped_column(Text, nullable=False)
    edited_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    edited_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

`edited_by`는 §8의 "관리자가 남의 메모를 고쳤을 때" 표시용. 작성자 본인 수정이면 채우지 않는다.

### 5-3. `care_board_reads` — 안 읽음 배지

```python
class CareBoardRead(BaseModel):
    __tablename__ = "care_board_reads"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    member_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "members"})
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    __table_args__ = (
        Index(
            "uq_care_board_reads_member",
            "center_id", "client_id", "member_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
```

멤버당 내담자당 1행 upsert.

### 5-4. `client_care_summaries` — AI 요약 캐시

`counseling_case_analyses`와 동형(케이스 단위 → 내담자 단위로 축만 다름).

```python
class ClientCareSummary(BaseModel):
    __tablename__ = "client_care_summaries"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    triggered_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processing")
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(80), nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_session_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
```

`source_session_count`로 "N회기 이후 갱신 안 됨" 배지를 판정한다(§10).

---

## 6. 쓰기 경로

### 6-1. 반응(reaction)

**새 emit은 필요 없다.** 원천 6곳에 이미 깔려 있으므로 `app/application/events/routes.py`의 `EVENT_REACTIONS`에 케어보드 대상 이벤트만 등록해 `CareBoardFacade.record_entry(...)`를 부른다. 도메인 모듈은 케어보드를 모른 채로 남는다(모듈 비노출).

반응 3종:

| 반응 | 하는 일 |
|---|---|
| `created` | entry upsert (표시 스냅샷 조립) |
| `updated` | 같은 `(source_table, source_id)` 행의 스냅샷 **전량 갱신** |
| `deleted` | `source_deleted_at` 기록 (행은 남김) |

부분 갱신은 두지 않는다 — 어느 필드가 낡았는지 추적이 안 된다.

### 6-2. 정합 크론 = 백필 스크립트

프로젝션의 최대 약점인 "반응 배선 누락 = 조용한 구멍"을 이 설계는 자가 치유한다.

- 백필은 6개 원천에서 `(id, 시각, 표시값)`을 뽑아 upsert하는 스크립트 하나
- `uq_care_board_entries_source` 덕에 **멱등**이므로 그대로 정합 크론으로 상시 재실행 가능
- 구멍이 나도 다음 크론에서 메워진다

기존 데이터 소급도 같은 스크립트로 한다. 케어보드는 과거가 곧 가치라 "신규만 기록"(활동로그의 선택)은 쓸 수 없다.

### 6-3. 메모 · 핀 · 읽음

일반 모듈 write 경로(`router → handler → facade → service → repository`). 메모 생성 시 `care_memos` 행과 `care_board_entries` 행(`kind='memo'`)을 같은 트랜잭션에서 만든다.

---

## 7. 읽기 경로 · 권한

읽기는 **단일 테이블 커서 조회**다.

```sql
WHERE center_id = ? AND client_id = ? AND deleted_at IS NULL
ORDER BY occurred_at DESC, id DESC
```

케이스가 5개든 이전 상담사가 3명이든 쿼리 모양이 안 변한다. `app/query`(agent 전용) vs application fan-out 딜레마도 없어진다 — 평범한 모듈 handler로 끝난다.

### 7-1. 2단 게이트

케어보드는 client 축이지 counselor 축이 아니다. **`owner_scope`를 스트림에 걸면 안 된다** — 본인이 쓴 것만 보이는 보드는 인계 도구가 아니다.

| 단계 | 판정 | 기준 |
|---|---|---|
| ① 보드 진입 | 이 내담자에 접근할 수 있나 — **사람 축, 1회** | `owner_scope is None`(관리자) 또는 `_resolve_assigned_client_ids`에 포함 |
| ② 행 표시 | 이 종류의 정보를 볼 수 있나 — **정보 축, kind 필터** | `read:counseling_note` 없으면 회기 본문 제외 등 |

①을 통과하면 **그 내담자의 전 이력**을 본다. 누가 썼는지로 거르지 않는다.

**게이트 ①은 이미 구현돼 있다** — `app/application/handlers/client/get_client.py:27` `_resolve_assigned_client_ids`(상담+검사 담당, 주담당+보조, **종료·탈퇴 포함**) union. 내담자 상세 단건 조회가 이미 이걸로 게이팅되므로 재사용한다. 케어보드만 다르게 하면 "상세는 열리는데 그 안의 보드만 안 열리는" 모순이 생긴다.

> ⚠️ 이 술어는 **단조 증가**한다 — 담당한 적 있으면 접근권이 영구히 남고, 그 집합 전원이 쓰기까지 한다. 오래된 센터일수록 한 내담자 보드에 쓸 수 있는 사람이 계속 늘어난다. 회수가 필요해지면 케어보드가 아니라 이 술어를 고치는 일이다.

### 7-2. 권한 배선

```python
require_permission(Permission.READ_CLIENT)      # 권한 카탈로그 체계 유지
  + _resolve_assigned_client_ids 술어 통과       # 실제 게이트
```

`write:care_memo` 같은 permission을 신설하지 않는다 — 역할 카탈로그에 축만 늘고 판정은 관계가 한다. 다만 이건 **관계 판정만으로 write를 여는 첫 사례**이므로(기존 write는 전부 `write:*`) 라우터에 이유를 한 줄 남긴다.

### 7-3. 알림 · 읽음 — 접근자 ≠ 수신자

여러 명이 쓰는 보드는 새 글 신호가 없으면 아무도 안 본다. 그러면 인계 도구로도 못 쓴다. 그래서 읽음·알림은 선택이 아니라 메모와 **같은 Phase**에 간다.

| | 범위 |
|---|---|
| **접근자** (읽기·쓰기 게이트) | 관리자 ∪ 담당 이력 |
| **알림 수신자 · 안 읽음 배지** | **담당 이력 있는 멤버만** |

관리자는 "볼 수 있고 쓸 수 있지만 구독하지는 않는다". 안 그러면 센터 전 내담자의 모든 메모 알림이 관리자에게 가고, 하루 수십 건이면 알림을 꺼서 담당자 알림까지 같이 죽는다.

**안 읽음 수는 목록과 같은 조건으로 센다** — 볼 수 있는 종류만, 내가 주체(`actor_id`)인 행은 빼고,
기준은 `created_at`(행이 생긴 시각)이다. `occurred_at`(사건 시각)으로 세면 지난주 회기를 오늘 완료
처리한 행이 "지난주 것"이라 영영 안 잡히고, `updated_at`으로 세면 재구축이 매 이벤트마다 전 행을
갱신하므로 전부 새 것이 된다. 배지는 "내가 볼 수 있는 남의 새 기록" 수다.

발송은 `notification` 모듈의 `notify_members`(EX-12 recipient_resolver)를 쓴다 — 수신자 목록이 게이트 ①의 역방향이라 새 개념이 없다.

실시간성은 낙관적 append + invalidate, 도크가 열려 있는 동안 30초 폴링이면 충분하다. 필드노트 WS 인프라를 끌어오지 않는다.

---

## 8. 메모 권한

| | 작성자 본인 | 센터장·관리자 | 그 외 접근자 |
|---|---|---|---|
| 작성 | ✓ | ✓ | ✓ |
| 수정 | ✓ | ✓ | ✗ |
| 삭제 | ✓ | ✓ | ✗ |
| 핀 토글 | ✓ | ✓ | ✓ (공용) |

- 삭제는 soft delete — 흔적 보존
- 핀이 공용인 이유: UI가 상단 고정 오버레이(모두에게 같은 것이 보임)로 그려져 있고, 개인별 핀은 "이 보드에서 중요한 건 이것"이라는 인계 신호로서의 값을 잃는다. `pinned_by`로 누가 올렸는지는 보인다
- **관리자가 남의 메모를 수정하면 작성자 이름은 그대로인데 내용이 바뀐다.** 임상 기록이라 `edited_by`를 남기고 UI에 "관리자 수정됨"을 표시한다

---

## 9. 표시 규칙

### 9-1. 본문 절삭

`counseling_notes.summary`(1000자)·`assessment_tasks.opinion`(Text)를 잘라 `body` 스냅샷에 굳힌다. **LLM을 쓰지 않는다** — 요약본과 원문의 뉘앙스가 갈리면 임상 리스크고, "원문은 원천 상세가 정본"이라는 원칙과도 맞는다.

- 문장 경계 우선(첫 마침표까지). 그게 너무 길면 120자에서 자르고 `…`
- **잘렸을 때만** `…`를 붙인다(안 잘렸는데 붙으면 뒤에 뭐가 더 있는 것처럼 읽힌다)
- 소견 미작성이면 `body = null` → UI는 "소견 미작성"(실시는 됐다는 뜻)

### 9-2. 삭제된 원본

**행은 남기고 클릭만 막는다.** `source_deleted_at`을 찍고 회색 처리 + 클릭 비활성 + "원본 삭제됨" 표기.

**어떻게 알아채나** — 재구축이 원천 전량을 훑으므로, 한 바퀴에서 **만나지 못한 행 = 원천에 없는 행**이다
(`PruneEntriesService`). 남은 행은 두 갈래로 갈린다:

| 남은 이유 | 처리 |
|---|---|
| 원천이 사라짐(회기·문서 삭제) | `source_deleted_at`을 찍고 행은 남긴다 |
| 원천은 있는데 이력에서 빠짐(완료 → 예정 되돌림) | 행을 치운다(soft delete) — 일어나지 않은 일이라 남길 맥락이 없다 |

치운 행은 유니크 인덱스가 `deleted_at IS NULL` 부분 인덱스라 다시 완료되면 새 행으로 살아나고,
사라졌다 돌아온 원천(문서 `restore`)은 upsert가 `source_deleted_at`을 되돌려 다시 열린다.

문서 삭제는 soft delete다 — `DeleteDocumentService`가 `deleted_at`만 찍고 S3 객체는 그대로 두며 `restore_document` 핸들러까지 있다. 파일은 살아 있다. 인계 관점에서 "8월에 동의서를 올렸다가 지웠다"는 것 자체가 맥락이고, 관리자가 되살릴 여지도 남는다. 회기 취소·케이스 종결과 같은 취급이라 규칙이 하나로 단순해진다.

### 9-3. 바우처 행 — 차감 이력 테이블은 필요 없다

차감은 이력을 쌓지 않고 `client_vouchers.remaining_sessions`를 그 자리에서 뺀다(`ConsumeSessionsService`). 그런데:

- 차감 경로가 **하나뿐**이다 — 청구서 생성(`create_billable_handler`)
- 되돌리는 경로가 없다 — billable에 DELETE 라우트 자체가 없고 복구 로직도 없다
- `billable_created` 이벤트 **하나에** billable atomic과 voucher atomic이 같이 실린다. billable_item의 `quantity`(차감량)와 voucher atomic `changed.remaining_sessions`(차감 직후 잔여)를 반응 하나에서 둘 다 읽는다

→ `"아동·청소년 심리지원 바우처 4회 차감 · 잔여 8회"`가 그대로 만들어진다. **별도 차감 이력 테이블을 신설하지 않는다.**

한계: 운영 보정으로 `remaining_sessions`를 직접 수정하는 경로는 청구를 거치지 않는다. `client_voucher updated` atomic으로 별도 행이 되며, "관리자 보정"으로 표시할지는 후속.

### 9-4. 인계 행

`kind='handover'` — "담당 변경: 김은지 → 박서연". `counseling_case_participants`의 `joined_at`/`left_at`과 `counseling_cases.counselor_id` 변경 atomic이 원천이다. 이게 없으면 인계받은 사람이 "여기부터 내 기록"이라는 경계를 못 읽는다.

### 9-5. 행 문구는 화면 어휘를 따른다 (2026-09-03)

행의 `title`/`meta`는 **그 동작을 사용자가 화면에서 부르는 이름**으로 쓴다. 시스템·모델 용어를 그대로 노출하지 않는다.

| 원천 | 문구 | 근거 |
|---|---|---|
| `counseling_cases` | `{프로그램} 접수` | 이 동작의 화면 이름이 "상담 접수"다(`/counseling/receive`). "케이스 개설"은 시스템 말 |
| `case_code` | `케이스번호 C00087` | 다른 화면(에이전트 결과 표)이 쓰는 라벨과 같게. "사례번호"는 케어보드에서만 쓰던 말이었다 |

⚠️ **문구는 서버가 만들어 DB에 굳힌다**(`title`/`meta` 스냅샷). 그래서 ① 문구를 바꾸면 기존 행은 그대로라 백필을 한 번 돌려야 하고, ② 웹의 어휘 프로필(`t()` — 기관 유형별 어휘)이 적용되지 않는다. ②는 미결(§15)로 남긴다 — 표시 시점 치환으로 옮기려면 행에 어휘 키를 함께 실어야 한다.

---

## 10. LLM 토큰 구간

케어보드에서 토큰을 태우는 곳은 **차트 ③ AI 요약 하나뿐**이다.

| 구간 | 토큰 |
|---|---|
| 타임라인 행 본문 | **0** — 전부 이미 저장된 값 |
| 차트 ④ 상담·검사 행 | **0** — 절삭(§9-1) |
| **차트 ③ AI 요약** | **과금** |

과금 골격은 이미 있다: `AIPurpose` 등록 → `AIFacade.verify_quota` → `generate_json` → `llm_calls` 기록 → 크레딧 차감. `TOKENS_PER_CREDIT = 2000`.

- 입력을 **회기 요약 + 검사 소견 절삭본**으로 제한 → 시스템 1K + 본문 3~5K + 출력 300 ≈ **5~6K 토큰 ≈ 3크레딧/회**
- `counseling_notes.content`(JSONB 원문)를 통째로 넣으면 `CASE_ANALYSIS`(14크레딧, ~21K)를 케이스 수만큼 넘어선다 → **넣지 않는다**

**가장 큰 위험은 단가가 아니라 호출 빈도다.** 도크는 상세 진입 시 자동으로 펼쳐진다(`INTRO_DELAY` 600ms). 여기에 생성을 물리면 내담자 상세를 열 때마다 과금된다.

- 결과는 `client_care_summaries`에 캐시하고 화면은 **읽기만**
- 생성은 **명시 버튼 + 크레딧 고지** (`counseling_case_analysis` 패턴)
- 새 회기가 쌓이면 "N회기 이후 갱신 안 됨" 배지만, **자동 재생성 금지**

배선: `AIPurpose.CARE_BOARD_SUMMARY` 추가 + `PURPOSE_ESTIMATED_CREDITS` + `PURPOSE_LABELS`. 실행은 Track B(`dispatch_job`이 기간 정산을 자동 커버).

### 10-1. LLM 입력은 절삭본이 아니라 원본이다 🔴

`entries.body`는 **표시용 120자 절삭본**이다(§9-1). 요약 파이프라인이 이걸 입력으로 쓰면 정보가 잘린 채 요약된다.

> 요약 파이프라인은 entries에서 `(source_table, source_id)` 목록과 `share_class`만 뽑고, **본문은 원본에서 다시 읽는다.**

`source_id` 보존은 행 클릭(표시 기능)이 아니라 **파생 산출물의 생명선**이다. 차트 요약·인계 패킷(§16) 둘 다 이 경로를 쓴다.

---

**AI는 요약만 한다 — 임상적 판단은 하지 않는다.** "무엇이 있었나"(회차·실시 내역·기록에 반복된 표현)까지가 AI의 몫이고, "그래서 어떤 상태인가·무엇을 해야 하나"는 소견을 쓰는 사람의 몫이다.

---

## 11. API

```
GET    /centers/{cid}/clients/{clid}/care-board/stream?cursor=&kinds=&limit=
POST   /centers/{cid}/clients/{clid}/care-board/read
POST   /centers/{cid}/clients/{clid}/care-board/rebuild

POST   /centers/{cid}/clients/{clid}/care-board/memos
PATCH  /centers/{cid}/clients/{clid}/care-board/memos/{memo_id}
DELETE /centers/{cid}/clients/{clid}/care-board/memos/{memo_id}
POST   /centers/{cid}/clients/{clid}/care-board/entries/{entry_id}/pin

GET    /centers/{cid}/clients/{clid}/care-board/chart            ← Phase 3, 아직 없음
POST   /centers/{cid}/clients/{clid}/care-board/summary          ← Phase 4, 아직 없음
GET    /centers/{cid}/clients/{clid}/care-board/summary/latest    ← Phase 4, 아직 없음
```

스트림 응답 행: `id·kind·occurred_at·title·subtitle·body·meta·actor_id·actor_name·pinned·pinned_by·source_table·source_id·source_deleted_at`. `actor_name`은 read 시점 live 해소(write 스냅샷 아님).

**커서 = `"{occurred_at}|{id}"`.** 정렬 키가 `(occurred_at, id)`이므로 커서도 둘 다 담는다 —
시각만 담으면 같은 시각 행이 여럿일 때(백필·일괄 등록) 그 시각 행들이 페이지 경계에서 통째로 넘어간다.
`kinds`가 전부 권한 밖이면 빈 목록을 준다(전체로 되돌리지 않는다 — 필터를 누른 결과가 전체가 되면 안 된다).

---

## 12. 프론트 (구현 완료)

```
CareBoardDock.svelte            표현 전용 — 서비스가 준 상태만 그린다
  └ features/clients/detail/care-board/
        care-board-service.ts   조회(무한 스크롤)·메모/핀/읽음·invalidate
        view-model.ts           행 변환·날짜/시각 라벨·KIND_META·FILTERS·sourceHref
  └ hooks/actions/care-board.action.ts   HTTP
```

- **스트림 = 커서 무한 스크롤.** 첫 묶음 50건, 위로 올리면 이어 붙인다(상단 160px 안에서 발화).
  공용 `infiniteQueryBuilder`는 skip/limit + `{items,total}` 전제라 못 쓴다 — `createInfiniteQuery`를 서비스 안에서 직접 구성한다(선례 `ClientCaseHistoryTab`).
- **위로 이어 붙일 때 스크롤 위치를 보정한다** — 늘어난 높이만큼 되밀지 않으면 읽던 자리가 통째로 아래로 튄다.
- **필터 전환은 `keepPreviousData`** — 이전 목록을 든 채 흐려졌다가 교체된다(빈 프레임 = 깜빡임). 교체 중임을 40% 흐림으로 말하고, 도착 시점(`isPlaceholderData` 하강)에 바닥으로 정렬한다.
- **메모·핀 변경 시 무효화는 `refetchType: 'all'`** — 보고 있는 필터만 갱신하면 다른 탭 캐시가 낡은 채 남아, 그 탭으로 옮겼을 때 옛 목록이 먼저 보였다가 새 행이 튀어 들어온다.
- **빈 메시지는 다 받아온 뒤에만** — 불러오는 동안 띄우면 "기록이 없다"가 깜빡였다가 목록이 들어찬다.
- 읽음 표시는 도크 열림당 1회. 성공하면 화면 숫자만 0으로 내린다 — 스트림을 무효화하면 읽음→refetch→읽음 루프가 된다.
- 미배선: 메모 수정·삭제 UI(API·서비스 메서드는 있음), 시크릿 모드 마스킹, 문서·필드노트·바우처 행의 이동 목적지(웹에 대응 화면 없음)

---

## 13. v0.1에서 바뀐 것

| 항목 | v0.1 (2026-01-28) | v1.0 | 이유 |
|---|---|---|---|
| 게시물 생성 주체 | 시스템만. 수동 메모는 Phase 2 | 시스템 + 사용자 메모 **동시** | UI가 메모 입력창을 1급으로 갖고, 메모 없이는 인계 보드로 못 씀 |
| 수정 | append-only, 수정 불가 | 메모는 작성자·관리자 수정 가능(§8) | 사용자 결정 2026-09-02 |
| 본문 저장 | 게시물에 `content` 템플릿 텍스트 | 표시 스냅샷 4필드 + 원본 참조 + 갱신 반응 | 원본 수정 반영 + 절삭 규칙(§9-1) |
| 협업 형태 | 2-depth 댓글 + 멘션 정규화 | **메모가 스트림에 평면으로 섞임** | 현 UI가 채팅형 단일 스트림. 댓글·멘션은 유예(§14) |
| 쓰기 경로 | 원천 도메인이 Careboard 서비스 직접 호출 | `EVENT_REACTIONS` 반응(§6-1) | 모듈 비노출 + 아웃박스 |
| 스키마 스타일 | `ForeignKey` · `UUID(as_uuid=True)` · `BigInteger` autoincrement · `is_deleted` | `String(36)` · FK 없음 · 마커 · `deleted_at` | 레포 규약(persistence-model) |
| 조회 API | 내담자 검색 + 타임라인 통합 | 내담자 상세 안의 도크라 검색 불요 | 진입 경로가 다름 |
| 핀 · 읽음 · 차트 · AI 요약 | 없음 | 있음 | UI에 있음 |

**이어받은 것**: `occurred_at`/`created_at` 분리 · `(center_id, client_id, occurred_at)` 인덱스 우선 · 원천 역추적 링크 · client 접근권 = 케어보드 접근권 · 소프트 삭제 + 내용 보존 · 멱등 기록.

---

## 14. Phase

| Phase | 내용 | 산출 |
|---|---|---|
| 1 | 스트림 읽기 전용 — `care_board_entries` + 반응 + 백필 + 조회 | 도크 실데이터 |
| 2 | 메모 + 핀 + **읽음/알림** | `care_memos`·`care_board_reads` |
| 3 | 차트 모달 조립(AI 제외) | 조회 1 |
| 4 | AI 요약 (Track B + 크레딧) | `client_care_summaries` + purpose |

1~3이 실사용 가치의 대부분이고 4는 비용이 붙는 별건이라 분리한다.

---

## 15. 미결

1. **차트 ② 주호소** — `chief_complaint`가 케이스별이라 복수 케이스일 때 무엇을 보일지(최신 케이스 / 전부 나열 / 진행중만)
2. **바우처 운영 보정 행** — 청구를 거치지 않은 `remaining_sessions` 직접 수정을 스트림에 올릴지(§9-3)
3. **댓글 · 멘션** — v0.1의 2-depth + 멘션 설계는 유효하나 현 UI에 자리가 없다. 스트림 행에 답글이 필요하다는 요구가 실측되면 그때 부활
4. **퇴사자 접근 회수** — §7-1 단조 증가 문제. 케어보드가 아니라 `_resolve_assigned_client_ids` 소관
5. **행 문구와 어휘 프로필** — 서버가 한글 문구를 DB에 굳혀서 기관 유형별 어휘(`t()`·쉼터 프로필 등)가 적용되지 않는다(§9-5). 표시 시점 치환으로 옮기려면 행에 어휘 키를 함께 실어야 한다
6. **재구축 증폭** — 이벤트 하나에 원자 변경이 여럿이면 같은 내담자를 그 수만큼 재구축한다(회기 10건 일괄 수정 = 10회). 워커가 밀리는 게 관측되면 ① 이벤트 그룹 안에서 내담자 단위로 묶기 → ② 바뀐 원천만 갱신하는 증분 경로 순
7. **인계 패킷 세부** — 동의 단위(센터+기간 / 항목) · 패킷 갱신 주기 · 수신 뷰어 배치(§16-7 미룸분)

---

---

## 16. 센터 간 인계 — 방향 확정, 구현 유예

내담자가 다른 센터로 옮길 때 **기록의 주체는 내담자/보호자**다. 그런데 넘어가는 것은 원본도 열람권도 아니고, **LLM으로 재가공한 인계 문서 한 부**다.

### 16-1. 케이스는 넘어가지 않는다

상담 케이스는 내담자의 속성이 아니라 **센터와 내담자 간의 계약**이다(프로그램·담당·총 회기·바우처·청구). B센터로 복사하면 즉시 막힌다 — 그 케이스의 회기를 누가 진행하나, 바우처 잔여는 누가 취급하나, 청구는 어느 센터인가. 답이 없다.

B센터가 상담을 시작하면 그건 **B의 새 케이스**고, A의 케이스는 A에 남아 종결된다.

### 16-2. 공유 단위 = 재가공 문서(인계 패킷)

live 참조 공유(타 센터 데이터를 직접 읽기)는 기각했다:

- `center_id` 필수 WHERE라는 멀티테넌트 불변식을 깨야 한다
- 권한 판정이 두 센터 정책에 걸치고, A가 고치면 B 화면이 말없이 바뀌고, A가 해지·폐업하면 B 화면이 빈다
- 범위가 모호한 백지 위임이라 **동의가 진짜 동의가 아니다**
- 상담사가 쓴 일지가 자동으로 새면 기록이 방어적으로 변한다 — 되돌리기 어려운 품질 손상

문서 전달은 이 넷을 전부 피하고, 실무 형태(소견서·의뢰서)와도 같다.

**패턴은 이미 레포에 있다** — `counseling_note_shares`(보호자 공유문):

```
LLM 초안(llm_call_id) → status=draft → 상담사 편집(is_edited)
  → published_at 발행 → audience가 읽음
```

인계 패킷은 여기서 `audience`가 타 센터가 되고, 범위가 회기 하나에서 내담자 전체 이력으로 넓어지고, **내담자 확인 단계가 하나 더** 붙는다.

### 16-3. 무엇이 들어가나

| 항목 | 주체 | 공유 |
|---|---|---|
| 케이스 사실(프로그램·회기 수·기간·상태) | 공동 | ✅ 기본 |
| 주호소 | 내담자가 한 말 | ✅ 기본 |
| 검사 실시 이력 | 공동 | ✅ 기본 |
| **검사 리포트 PDF** | **내담자**(이미 발급 대상) | ✅ 동의 시 |
| 검사 소견 `opinion` | 상담사 | ⚠️ 동의 + 센터 확인 |
| 일지 요약 `summary` | 상담사 | ⚠️ 동의 + 센터 확인 |
| 일지 원문 `content` | 상담사 | ❌ |
| AI 분석 | 시스템 | ❌ (G1이 이미 막음) |
| 필드노트·녹음·전사 | 센터 내부 | ❌ |
| 공유 메모 | 센터 내부 | ❌ |
| 바우처·청구 | 센터 계약 | ❌ (B에서 새로) |

일지 원문을 빼는 이유: ① 보호자에게도 안 보이는 걸(G1) 타 기관에 여는 건 앞뒤가 안 맞고 ② 3자 정보·미확정 가설이 맥락 없이 읽히면 낙인이 되며 ③ **작성자 동의가 빠져 있다**.

`entries.share_class`가 이 표의 3단 압축이다. "clinical 중 무엇을 열었나"는 패킷이 항목 단위로 갖는다 — **분류(entries)와 정책(패킷)을 분리**한다.

### 16-4. 패킷이 갖춰야 할 것

1. **AI 초안 → 상담사 확정 필수.** 검증 없는 LLM 산출물이 타 기관의 임상 판단 자료가 되면 안 된다
2. **기준 시점 명시.** 소견서가 발급일 기준인 것과 같다. 갱신은 재발급
3. **수신 측에 출처 배지.** 센터명·작성자·기준 시점이 항상 붙는다 — 없으면 B센터 상담사가 A센터의 관찰을 자기 관찰처럼 인용한다
4. **내담자가 읽을 수 있는 수준.** 내담자 확인이 동의 요건이라 자동으로 걸리는 제약. 원문이 아닌 재가공물이라 G1과 충돌하지 않는다
5. **수신 = 스트림 행 + 별도 뷰어.** 행은 진입점("A센터 인계 요약 수신"), 열면 문서. §9-2의 클릭 불가 행 메커니즘 재사용

### 16-5. 차트 요약과 합치지 않는다

| | 차트 AI 요약 | 인계 패킷 |
|---|---|---|
| 대상 | 내부 상담사 | 타 센터 |
| 성격 | 사실 요약, 짧음, 판단 금지 | 구조화 문서(주호소·경과·검사·종결사유·권고) |
| 확정 | 불필요(캐시) | 상담사 확정 + 내담자 확인 |
| 무게 | 화면 보조 | 대외 산출물 |

같은 입력(entries)에서 나오지만 다른 산출물이다. **입력 조립만 공유**하고(`share_class` 필터로 무엇을 넣을지만 다름) 프롬프트·저장·수명은 분리한다.

### 16-6. 그래서 entries의 정체

전용 테이블은 "화면 캐시"가 아니라 **모든 파생 산출물의 단일 입력**이다.

```
care_board_entries ─┬─→ 차트 AI 요약  (내부용 단면)
    (단일 입력)      └─→ 인계 패킷     (외부 전달용 문서)
```

fan-out 설계였다면 두 산출물이 각자 6개 원천을 다시 긁어야 했다. 이 성질이 §4의 결정을 사후적으로 더 강하게 정당화한다.

### 16-7. 지금 하는 것 / 미루는 것

공유는 현 시점 우선순위가 낮다. **나중에 못 넣는 것만** 지금 넣는다.

| 지금 (Phase 1) | 미룸 |
|---|---|
| `entries.share_class` — 나중이면 전량 백필 | `care_transfer_packets` 도메인 |
| `entries.person_id` — 싸고, 발급·수신 매칭 키 | 동의 플로우 · 앱 UI · 수신 뷰어 |
| §10-1 원본 재조회 원칙 | 패킷 프롬프트·발행 상태기계 |

**작성일**: 2026-09-02 · **버전**: 1.0
