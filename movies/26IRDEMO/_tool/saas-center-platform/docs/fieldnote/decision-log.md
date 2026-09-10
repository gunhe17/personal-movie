# FieldNote 도메인 설계 의사결정 기록

> 제1원칙 기반 질문-답변을 통한 FieldNote 도메인 설계 의사결정 과정

---

## 의사결정 일자

2026-01-16

---

## 의사결정 방식

**제1원칙(First Principles) 접근**:
1. 근본 개념부터 정의 (FieldNote의 책임과 역할)
2. 비즈니스 요구사항을 구체적 시나리오로 검증
3. 여러 옵션 제시 후 트레이드오프 분석
4. 명시적 의사결정 및 근거 기록

---

## 질문 1: FieldNote의 책임 범위

### 질문
FieldNote 엔티티가 담당해야 하는 책임은 무엇인가요?

### 옵션
- **옵션 A**: 녹음 + STT + 메모 통합 관리
- **옵션 B**: 녹음/STT만 (메모는 별도 도메인)
- **옵션 C**: 메모만 (녹음은 별도 서비스)

### 결정
**옵션 A: 녹음 + STT + 메모 통합 관리**

### 근거
- **통합 컨텍스트**: 녹음, STT, 메모는 하나의 세션에서 함께 발생
- **시간 동기화**: Voice와 Memo 모두 녹음 타임라인 기준으로 연결
- **단일 진입점**: 필드노트 하나로 상담 기록 전체 관리
- **UX 일관성**: 사용자가 하나의 화면에서 모든 기록 확인

### 구조
```python
FieldNote:
  - audio_file_url: 녹음 파일
  - full_transcript: 전체 STT 텍스트
  - voices: [Voice]  # STT 구간별 기록
  - memos: [Memo]    # 관찰/메모 기록
```

---

## 질문 2: FieldNote와 Session의 관계

### 질문
FieldNote와 Session의 관계는?

### 옵션
- **옵션 A**: 1:1 필수 (하나의 세션에 하나의 필드노트)
- **옵션 B**: 1:N (하나의 세션에 여러 필드노트 가능)
- **옵션 C**: N:1 (여러 세션을 하나의 필드노트로)

### 결정
**옵션 B: 1:N (하나의 세션에 여러 필드노트 가능)**

### 근거
- **여러 전문가 지원**: 동일 세션에 여러 전문가가 각자 필드노트 작성 가능
- **분할 기록**: 긴 세션을 여러 필드노트로 나눠 기록 가능
- **유연성**: 추가 기록이 필요한 경우 새 필드노트 생성

### 구조
```python
# Session : FieldNote = 1 : N
class FieldNote(Base):
    session_id: Mapped[uuid] = mapped_column(
        ForeignKey("sessions.id"),
        nullable=False
    )
    created_by: Mapped[uuid] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

# 동일 세션, 다른 작성자
FieldNote(session_id=1, created_by=10)  # 상담사 A
FieldNote(session_id=1, created_by=20)  # 상담사 B
```

---

## 질문 3: FieldNote가 지원하는 Session 유형

### 질문
FieldNote는 어떤 Session 유형을 지원하나요?

### 옵션
- **옵션 A**: CounselingSession만
- **옵션 B**: CounselingSession + AssessmentSession
- **옵션 C**: 모든 세션 유형 (Polymorphic)

### 결정
**옵션 C: 모든 세션 유형 (Polymorphic) + 독립 서비스 가능성 고려**

### 근거
- **범용성**: 상담, 검사, 기타 모든 세션에서 필드노트 활용 가능
- **확장성**: 새로운 세션 유형 추가 시 FieldNote 수정 불필요
- **독립 서비스 가능성**: 향후 별도 마이크로서비스로 분리될 수 있음
- **Polymorphic 패턴**: Schedule과 동일한 패턴 적용

### 구조
```python
class FieldNote(Base):
    # Polymorphic Relations
    related_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )  # "COUNSELING", "ASSESSMENT", "OTHER"
    related_id: Mapped[uuid] = mapped_column(nullable=False)

    __table_args__ = (
        Index("idx_fieldnote_related", "related_type", "related_id"),
    )

# 사용 예시
FieldNote(related_type="COUNSELING", related_id=session_id)
FieldNote(related_type="ASSESSMENT", related_id=assessment_session_id)
```

### 독립 서비스 고려사항
```
Phase 1: 모놀리스 내 모듈
  └── app/modules/fieldnote/

Phase 2+: 독립 서비스 분리 가능
  └── 별도 DB, API, 스토리지
  └── 다른 센터 시스템과도 연동 가능
```

---

## 질문 4: Voice의 speaker 값 정의

### 질문
Voice의 speaker 값은 어떻게 정의하나요?

### 옵션
- **옵션 A**: 고정값 (THERAPIST, PATIENT만)
- **옵션 B**: 동적 (참여자 ID 참조)
- **옵션 C**: 자유 입력 (문자열)

### 결정
**옵션 A: 고정값 (THERAPIST, PATIENT만) - 확장 가능**

### 근거
- **단순성**: 대부분의 상담은 상담사-내담자 1:1
- **일관성**: Enum으로 정의하여 데이터 무결성 보장
- **확장 가능**: 그룹 상담 등 화자가 늘어나면 Enum에 추가
  - `THERAPIST`, `PATIENT`, `GUARDIAN`, `CO_THERAPIST` 등

### 구조
```python
# app/modules/fieldnote/voice/schemas.py
from enum import Enum

class Speaker(str, Enum):
    THERAPIST = "THERAPIST"  # 상담사/치료사
    PATIENT = "PATIENT"      # 내담자/환자
    # Phase 2 확장
    # GUARDIAN = "GUARDIAN"    # 보호자
    # CO_THERAPIST = "CO_THERAPIST"  # 공동 상담사

class Voice(Base):
    speaker: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )
```

---

## 질문 5: Voice 생성 시점

### 질문
Voice는 실시간으로 생성되나요, 녹음 완료 후 일괄 생성되나요?

### 옵션
- **옵션 A**: 실시간 (STT 스트리밍)
- **옵션 B**: 녹음 완료 후 일괄 처리
- **옵션 C**: 둘 다 지원

### 결정
**옵션 A: 실시간 (STT 스트리밍)**

### 근거
- **즉각적 피드백**: 상담 중 실시간으로 텍스트 확인 가능
- **메모 동기화**: 실시간 STT와 함께 메모 작성 가능
- **UX**: 녹음 종료 후 대기 시간 없음

### 구현 방향
```python
# WebSocket 기반 실시간 STT
async def on_audio_chunk(chunk: bytes, field_note_id: uuid):
    # 1. STT 서비스로 전송
    stt_result = await stt_service.transcribe(chunk)

    # 2. Voice 레코드 생성
    voice = await voice_repo.create({
        "field_note_id": field_note_id,
        "start_time": stt_result.start,
        "end_time": stt_result.end,
        "speaker": stt_result.speaker,
        "text": stt_result.text
    })

    # 3. 클라이언트에 실시간 전송
    await websocket.send(voice)
```

---

## 질문 6: Voice의 text 수정 가능 여부

### 질문
Voice의 text 수정이 가능한가요?

### 옵션
- **옵션 A**: 수정 불가 (STT 원본 유지)
- **옵션 B**: 수정 가능 (사용자 교정)
- **옵션 C**: 원본 + 수정본 둘 다 저장

### 결정
**옵션 C: 원본 + 수정본 둘 다 저장**

### 근거
- **원본 보존**: STT 정확도 분석, 감사 로그 용도
- **교정 허용**: STT 오류 수정 필요 (고유명사, 전문 용어 등)
- **투명성**: 수정 이력 추적 가능

### 구조
```python
class Voice(Base):
    text_original: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )  # STT 원본 (수정 불가)
    text: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )  # 현재 텍스트 (수정 가능)
    is_edited: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )  # 수정 여부 플래그

# 수정 시
voice.text = "수정된 내용"
voice.is_edited = True
# voice.text_original은 유지
```

---

## 질문 7: Memo의 category 값

### 질문
Memo의 category 값은 고정인가요, 확장 가능한가요?

### 옵션
- **옵션 A**: 고정 (OBSERVATION, SPEECH, BEHAVIOR, EMOTION, OTHER)
- **옵션 B**: 센터별 커스텀 가능
- **옵션 C**: 자유 입력

### 결정
**옵션 C: 자유 입력**

### 근거
- **유연성**: 다양한 상담 유형별 맞춤 카테고리 지원
- **단순성**: 별도 카테고리 관리 테이블 불필요
- **빠른 적용**: 새로운 카테고리 즉시 사용 가능

### 구조
```python
class Memo(Base):
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )  # 자유 입력: "OBSERVATION", "행동관찰", "감정변화" 등

# 권장 카테고리 (문서/UI 가이드)
SUGGESTED_CATEGORIES = [
    "OBSERVATION",  # 관찰
    "SPEECH",       # 언어
    "BEHAVIOR",     # 행동
    "EMOTION",      # 감정
    "OTHER"         # 기타
]
```

---

## 질문 8: Memo 생성 시점

### 질문
Memo 생성 시점은?

### 옵션
- **옵션 A**: 녹음 중에만 (실시간)
- **옵션 B**: 녹음 후에도 추가 가능
- **옵션 C**: 언제든지 (녹음 없이도)

### 결정
**옵션 C: 언제든지 (녹음 없이도)**

### 근거
- **유연성**: 녹음 없는 세션에서도 메모 기록 가능
- **사후 기록**: 세션 종료 후 추가 관찰 내용 기록
- **다양한 사용 사례**: 녹음 + 메모, 메모만, 등

### 시나리오
```python
# 시나리오 A: 녹음 중 실시간 메모
FieldNote(audio_file_url="...", status="DRAFT")
Memo(timestamp=120000, text="눈 맞춤 회피")

# 시나리오 B: 녹음 없이 메모만
FieldNote(audio_file_url=None, status="DRAFT")
Memo(timestamp=None, text="초기 면담 내용")

# 시나리오 C: 녹음 완료 후 메모 추가
FieldNote(status="COMPLETED")
# → 불가 (COMPLETED 상태에서 수정 불가)
```

---

## 질문 9: Memo의 timestamp 필수 여부

### 질문
Memo의 timestamp는 필수인가요?

### 옵션
- **옵션 A**: 필수 (녹음 시점 기준)
- **옵션 B**: 선택 (녹음 없으면 null)
- **옵션 C**: 생성 시점 자동 기록

### 결정
**옵션 C: 생성 시점 자동 기록**

### 근거
- **항상 기록**: 언제 메모가 작성되었는지 추적 가능
- **녹음 연동**: 녹음 중이면 녹음 기준 타임스탬프
- **비녹음**: 녹음 없으면 생성 시점 기준

### 구조
```python
class Memo(Base):
    # 녹음 기준 타임스탬프 (녹음 중일 때)
    recording_timestamp: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )  # 녹음 기준 ms (없으면 null)

    # 생성 시점 (항상 기록)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

# 녹음 중 메모: recording_timestamp = 120000
# 녹음 없이 메모: recording_timestamp = null, created_at 기준
```

---

## 질문 10: audio_file_url 저장 방식

### 질문
audio_file_url 저장 방식은?

### 옵션
- **옵션 A**: 외부 스토리지 URL만 저장 (S3 등)
- **옵션 B**: DB에 바이너리 저장
- **옵션 C**: 로컬 파일 경로

### 결정
**옵션 A: 외부 스토리지 URL만 저장 (S3 등)**

### 근거
- **확장성**: 대용량 오디오 파일은 외부 스토리지가 적합
- **성능**: DB 부하 감소
- **비용 효율**: 스토리지 비용 최적화
- **CDN 연동**: 빠른 파일 전송 가능

### 구조
```python
class FieldNote(Base):
    audio_file_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )  # 예: "https://storage.example.com/audio/fn_abc123.webm"

# 파일 업로드 플로우
1. 클라이언트 → Presigned URL 요청
2. 서버 → S3 Presigned URL 발급
3. 클라이언트 → S3 직접 업로드
4. 클라이언트 → FieldNote에 URL 저장 요청
```

---

## 질문 11: 오디오 파일 보존 기간 정책

### 질문
오디오 파일 보존 기간 정책은?

### 옵션
- **옵션 A**: 영구 보존
- **옵션 B**: 일정 기간 후 자동 삭제
- **옵션 C**: 센터 설정에 따름

### 결정
**옵션 A: 영구 보존**

### 근거
- **법적 요구사항**: 상담 기록 보존 의무 (의료법, 상담윤리)
- **증거 자료**: 분쟁 발생 시 증빙 자료로 활용
- **재분석**: 향후 AI 기술 발전 시 재분석 가능
- **비용**: 스토리지 비용은 감당 가능 수준

### 예외 처리
```python
# 삭제 요청 시 (개인정보 보호법)
# → Soft Delete: 파일은 유지, 접근만 차단
# → 법적 보존 기간 이후 실제 삭제 가능

class FieldNote(Base):
    deleted_at: Mapped[datetime | None]  # Soft Delete
    # audio_file_url은 유지, 접근 시 deleted_at 확인
```

---

## 질문 12: FieldNote의 status 전이 규칙

### 질문
FieldNote의 status 전이 규칙은?

### 옵션
- **옵션 A**: DRAFT → COMPLETED → ARCHIVED (단방향)
- **옵션 B**: 자유 전이 가능
- **옵션 C**: DRAFT ↔ COMPLETED, COMPLETED → ARCHIVED

### 결정
**옵션 C: DRAFT ↔ COMPLETED, COMPLETED → ARCHIVED**

### 근거
- **수정 허용**: COMPLETED에서 DRAFT로 되돌려 수정 가능
- **보관 확정**: ARCHIVED는 최종 상태, 되돌리기 불가
- **실수 방지**: COMPLETED 실수로 설정 시 복구 가능

### 상태 전이도
```
          ┌──────────────┐
          │              │
          ↓              │
       DRAFT ←───────→ COMPLETED ────→ ARCHIVED
          │                              (최종)
          │
    (녹음 중/편집 중)   (완료)           (보관)
```

### 구현
```python
class FieldNoteStatus(str, Enum):
    DRAFT = "DRAFT"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"

ALLOWED_TRANSITIONS = {
    "DRAFT": ["COMPLETED"],
    "COMPLETED": ["DRAFT", "ARCHIVED"],
    "ARCHIVED": []  # 최종 상태, 전이 불가
}

def validate_status_transition(current: str, new: str) -> bool:
    return new in ALLOWED_TRANSITIONS.get(current, [])
```

---

## 질문 13: COMPLETED 상태에서 수정 가능 여부

### 질문
COMPLETED 상태에서 수정이 가능한가요?

### 옵션
- **옵션 A**: 불가 (잠금)
- **옵션 B**: Voice/Memo 추가만 가능
- **옵션 C**: 모든 수정 가능

### 결정
**옵션 A: 불가 (잠금)**

### 근거
- **데이터 무결성**: 완료된 기록은 변경 방지
- **법적 증빙**: 완료 시점의 기록 보존
- **명확한 워크플로우**: 수정 필요 시 DRAFT로 되돌린 후 수정

### 워크플로우
```python
# COMPLETED 상태에서 수정 시도
PATCH /fieldnotes/{id}
→ 400 Bad Request: "COMPLETED 상태에서는 수정할 수 없습니다.
                    DRAFT로 변경 후 수정하세요."

# 수정이 필요한 경우
1. PATCH /fieldnotes/{id} { "status": "DRAFT" }  # 상태 변경
2. PATCH /fieldnotes/{id}/voices/{voice_id} { "text": "수정 내용" }  # 수정
3. PATCH /fieldnotes/{id} { "status": "COMPLETED" }  # 다시 완료
```

---

## 질문 14: FieldNote 생성 권한

### 질문
FieldNote 생성 권한은?

### 옵션
- **옵션 A**: 세션 담당자만
- **옵션 B**: 센터 구성원 누구나
- **옵션 C**: 특정 역할만 (상담사, 센터장)

### 결정
**누구나 가능 (센터 구성원)**

### 근거
- **유연성**: 인턴, 실습생도 필드노트 작성 가능
- **협업**: 여러 전문가가 동일 세션에 각자 기록 가능
- **단순성**: 복잡한 권한 검증 불필요

### 제약사항
```python
# 제약: 센터 구성원만 (센터 소속 확인)
@require_center_member
async def create_fieldnote(data: FieldNoteCreate, auth: Auth):
    # center_id는 auth에서 추출
    # 누구나 생성 가능, 단 센터 소속이어야 함
    ...
```

---

## 질문 15: FieldNote 조회 권한

### 질문
FieldNote 조회 권한은?

### 옵션
- **옵션 A**: 생성자만
- **옵션 B**: 세션 관련자 (담당자 + 내담자)
- **옵션 C**: 센터 구성원 전체

### 결정
**옵션 A: 생성자만**

### 근거
- **개인 기록**: 필드노트는 작성자 개인의 관찰 기록
- **프라이버시**: 다른 상담사의 필드노트 열람 제한
- **책임 명확**: 작성자가 자신의 기록에 책임

### 예외
```python
# 예외: 센터장/관리자는 모든 필드노트 조회 가능 (관리 목적)
@require_permission("fieldnote:read_all")
async def get_all_fieldnotes_admin(center_id: int):
    ...

# 기본: 본인 필드노트만
async def get_my_fieldnotes(auth: Auth):
    return await repo.find_by_created_by(auth.user_id)
```

---

## 질문 16: 내담자(Client) FieldNote 조회

### 질문
내담자(Client)가 FieldNote를 조회할 수 있나요?

### 옵션
- **옵션 A**: 불가 (내부 문서)
- **옵션 B**: 요약본만 조회 가능
- **옵션 C**: 전체 조회 가능

### 결정
**옵션 A: 불가 (내부 문서)**

### 근거
- **전문가 기록**: 필드노트는 전문가의 내부 관찰 기록
- **솔직한 기록**: 내담자 열람 불가 시 솔직한 관찰 가능
- **별도 공유**: 공유가 필요한 내용은 별도 문서로 작성

### 구현
```python
# Client 앱에서는 FieldNote API 자체가 없음
# 센터 앱에서만 FieldNote 접근 가능

# 공유가 필요한 경우 → 별도 "상담 요약" 기능 (Phase 2)
```

---

## 질문 17: full_transcript 개인정보 처리

### 질문
full_transcript에 개인정보가 포함될 경우 처리 방법은?

### 옵션
- **옵션 A**: 자동 마스킹 (AI 기반)
- **옵션 B**: 수동 편집
- **옵션 C**: 별도 처리 없음

### 결정
**옵션 A: 자동 마스킹 (AI 기반) - Phase 2 구현 예정**

### 근거
- **개인정보 보호**: 전화번호, 주민번호, 주소 등 자동 탐지 및 마스킹
- **효율성**: 수동 편집 부담 감소
- **일관성**: 동일한 규칙으로 전체 적용

### 구현 계획 (Phase 2)
```python
# Phase 1: 수동 편집 (Voice.text 수정 가능)
# Phase 2: AI 자동 마스킹

class PIIMaskingService:
    """개인정보 자동 마스킹 (Phase 2)"""

    async def mask_transcript(self, text: str) -> str:
        # 1. NER (Named Entity Recognition)으로 개인정보 탐지
        # 2. 패턴 기반 탐지 (전화번호, 주민번호 등)
        # 3. 마스킹 적용
        return masked_text

# 적용 시점: Voice 생성 시 자동 적용
# 원본은 text_original에 보존 (암호화)
```

---

## 질문 18: 오디오 파일 암호화

### 질문
오디오 파일 암호화가 필요한가요?

### 옵션
- **옵션 A**: 필수 (저장 시 암호화)
- **옵션 B**: 선택 (센터 설정)
- **옵션 C**: 불필요 (접근 제어만)

### 결정
**옵션 A: 필수 (저장 시 암호화)**

### 근거
- **민감 데이터**: 상담 녹음은 매우 민감한 개인정보
- **법적 요구사항**: 개인정보보호법 준수
- **보안 계층화**: 접근 제어 + 암호화 (다중 보호)

### 구현
```python
# S3 Server-Side Encryption (SSE-S3 또는 SSE-KMS)
# 저장 시 자동 암호화, 조회 시 자동 복호화

# 추가 보안 (Phase 2)
# - Client-Side Encryption
# - Presigned URL 만료 시간 단축 (5분)
# - 다운로드 제한 (스트리밍만 허용)
```

---

## 질문 19: FieldNote API 경로

### 질문
FieldNote API 경로는?

### 옵션
- **옵션 A**: `/sessions/{id}/fieldnote` (세션 하위)
- **옵션 B**: `/fieldnotes` (독립)
- **옵션 C**: `/centers/{id}/fieldnotes` (센터 하위)

### 결정
**옵션 B: `/fieldnotes` (독립)**

### 근거
- **독립 서비스 가능성**: 향후 별도 서비스로 분리 시 경로 변경 최소화
- **Polymorphic 지원**: 다양한 세션 유형과 연결 가능
- **단순성**: 명확한 리소스 경로

### API 설계
```http
# FieldNote CRUD
GET    /fieldnotes                    # 목록 조회 (본인 것만)
POST   /fieldnotes                    # 생성
GET    /fieldnotes/{id}               # 상세 조회
PATCH  /fieldnotes/{id}               # 수정
DELETE /fieldnotes/{id}               # 삭제 (Soft)

# 필터링
GET /fieldnotes?related_type=COUNSELING&related_id={session_id}
```

---

## 질문 20: Voice/Memo API 경로

### 질문
Voice/Memo API는 FieldNote 하위인가요?

### 옵션
- **옵션 A**: 하위 (`/fieldnotes/{id}/voices`)
- **옵션 B**: 독립 (`/voices`, `/memos`)
- **옵션 C**: FieldNote 생성/수정 시 함께 처리

### 결정
**옵션 A: 하위 (`/fieldnotes/{id}/voices`, `/fieldnotes/{id}/memos`)**

### 근거
- **리소스 계층**: Voice/Memo는 FieldNote의 하위 리소스
- **권한 상속**: FieldNote 권한으로 하위 리소스 접근 제어
- **URL 명확성**: 어떤 FieldNote의 Voice/Memo인지 명확

### API 설계
```http
# Voice
GET    /fieldnotes/{id}/voices              # 목록
POST   /fieldnotes/{id}/voices              # 생성 (실시간 STT)
GET    /fieldnotes/{id}/voices/{voice_id}   # 상세
PATCH  /fieldnotes/{id}/voices/{voice_id}   # 수정 (text 교정)

# Memo
GET    /fieldnotes/{id}/memos               # 목록
POST   /fieldnotes/{id}/memos               # 생성
GET    /fieldnotes/{id}/memos/{memo_id}     # 상세
PATCH  /fieldnotes/{id}/memos/{memo_id}     # 수정
DELETE /fieldnotes/{id}/memos/{memo_id}     # 삭제
```

---

## 질문 21: FieldNote 삭제 정책

### 질문
FieldNote 삭제 정책은?

### 옵션
- **옵션 A**: Hard Delete
- **옵션 B**: Soft Delete
- **옵션 C**: 삭제 불가 (ARCHIVED만)

### 결정
**옵션 B: Soft Delete**

### 근거
- **데이터 보존**: 실수로 삭제 시 복구 가능
- **법적 요구사항**: 상담 기록 보존 의무
- **감사 추적**: 삭제 이력 추적 가능

### 구현
```python
class FieldNote(Base):
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

# Repository
async def soft_delete(self, id: uuid):
    await self.update(id, {"deleted_at": datetime.utcnow()})

async def get_active(self, id: uuid):
    return await self.session.execute(
        select(FieldNote)
        .where(FieldNote.id == id)
        .where(FieldNote.deleted_at.is_(None))
    )
```

---

## 질문 22: AI 기능 연동 범위

### 질문
AI 기능 연동 범위는? (Phase 2)

### 옵션
- **옵션 A**: STT만
- **옵션 B**: STT + 요약
- **옵션 C**: STT + 요약 + 감정 분석

### 결정
**옵션 B: STT + 요약 (Phase 2)**

### 근거
- **핵심 가치**: STT와 요약이 가장 실용적
- **복잡도 관리**: 감정 분석은 정확도 검증 필요 (Phase 3)
- **비용 효율**: 단계적 도입으로 비용 관리

### 구현 계획
```python
# Phase 1: 기본 기능
- FieldNote CRUD
- Voice (실시간 STT)
- Memo (수동 메모)

# Phase 2: AI 강화
- full_transcript 자동 생성 (Voice 통합)
- AI 요약 생성
- 개인정보 자동 마스킹

# Phase 3: 고급 분석
- 감정 분석
- 키워드 추출
- 상담 품질 분석

class AIService:
    async def generate_summary(self, field_note_id: uuid) -> str:
        """필드노트 요약 생성 (Phase 2)"""
        voices = await voice_repo.find_by_field_note(field_note_id)
        transcript = " ".join([v.text for v in voices])
        return await llm_service.summarize(transcript)
```

---

## 의사결정 요약표

| # | 질문 | 결정 | Phase |
|---|------|------|-------|
| 1 | 책임 범위 | 녹음 + STT + 메모 통합 관리 | Phase 1 |
| 2 | Session 관계 | 1:N (여러 필드노트 가능) | Phase 1 |
| 3 | Session 유형 | Polymorphic (모든 유형) + 독립 서비스 가능 | Phase 1 |
| 4 | Voice speaker | 고정값 (THERAPIST, PATIENT) - 확장 가능 | Phase 1 |
| 5 | Voice 생성 시점 | 실시간 (STT 스트리밍) | Phase 1 |
| 6 | Voice text 수정 | 원본 + 수정본 둘 다 저장 | Phase 1 |
| 7 | Memo category | 자유 입력 | Phase 1 |
| 8 | Memo 생성 시점 | 언제든지 (녹음 없이도) | Phase 1 |
| 9 | Memo timestamp | 생성 시점 자동 기록 | Phase 1 |
| 10 | audio_file_url | 외부 스토리지 URL (S3) | Phase 1 |
| 11 | 오디오 보존 | 영구 보존 | Phase 1 |
| 12 | status 전이 | DRAFT ↔ COMPLETED → ARCHIVED | Phase 1 |
| 13 | COMPLETED 수정 | 불가 (잠금) | Phase 1 |
| 14 | 생성 권한 | 센터 구성원 누구나 | Phase 1 |
| 15 | 조회 권한 | 생성자만 | Phase 1 |
| 16 | 내담자 조회 | 불가 (내부 문서) | Phase 1 |
| 17 | 개인정보 마스킹 | AI 자동 마스킹 | Phase 2 |
| 18 | 오디오 암호화 | 필수 (SSE) | Phase 1 |
| 19 | API 경로 | `/fieldnotes` (독립) | Phase 1 |
| 20 | Voice/Memo API | FieldNote 하위 | Phase 1 |
| 21 | 삭제 정책 | Soft Delete | Phase 1 |
| 22 | AI 연동 | STT + 요약 | Phase 2 |

---

## 참고 문서

- **FieldNote 도메인**: `/docs/fieldnote/domain.md` (작성 예정)
- **FieldNote 시나리오**: `/docs/fieldnote/scenarios.md` (작성 예정)
- **Counseling 도메인**: `/docs/counseling/domain.md`
- **Person 도메인**: `/docs/person/domain.md`
- **전체 아키텍처**: `/CLAUDE.md`
