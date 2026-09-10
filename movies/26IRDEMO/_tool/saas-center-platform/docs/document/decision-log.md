# Document 도메인 의사결정 로그

## 제1원칙 기반 접근

**핵심 질문**: "문서 관리 시스템의 본질적 목적은 무엇인가?"

**제1원칙 분해**:
1. 파일은 데이터의 집합이다 (바이트 스트림)
2. 문서는 파일 + 메타데이터 + 접근 권한의 조합이다
3. 버전 관리는 시간에 따른 변경 이력 추적이다
4. 멀티테넌트는 데이터의 완전한 논리적 격리를 요구한다
5. 보안은 접근 가능 여부 + 무결성 검증이다

---

## 질문 1: 파일 저장소를 어떻게 선택할 것인가?

### 질문
파일 저장소로 로컬 파일시스템을 사용할 것인가, S3를 사용할 것인가?

### 옵션

#### 옵션 A: 로컬 파일시스템
- **장점**:
  - 추가 인프라 불필요 (개발/테스트 간편)
  - 네트워크 지연 없음 (빠른 읽기/쓰기)
  - 비용 절감 (외부 스토리지 비용 없음)
- **단점**:
  - 서버 디스크 용량 제한
  - 백업/복구 복잡
  - 멀티 서버 환경에서 파일 동기화 문제
- **적합한 상황**: 단일 서버, 작은 파일 (<10GB), 초기 MVP

#### 옵션 B: AWS S3
- **장점**:
  - 무제한 확장성
  - 자동 백업 및 복제 (99.999999999% 내구성)
  - CDN 연동 가능 (CloudFront)
  - 멀티 서버 환경 적합
  - 수명 주기 정책 (자동 아카이브, 삭제)
- **단점**:
  - 추가 비용 (저장 용량, 트래픽)
  - 네트워크 지연 (로컬보다 느림)
  - AWS 종속성
- **적합한 상황**: 프로덕션 환경, 대용량, 장기 운영

#### 옵션 C: MinIO (Self-hosted S3)
- **장점**:
  - S3 호환 API (코드 변경 최소)
  - 자체 서버 운영 (비용 절감)
  - 클라우드 독립성
- **단점**:
  - 인프라 운영 부담
  - 확장성 제한 (서버 증설 필요)

### 결정
**옵션 B: AWS S3 (처음부터 사용)**

### 근거
- **확장성 우선**: 초기부터 확장 가능한 인프라 구축
- **운영 부담 최소화**: 백업, 복제, 모니터링 AWS 관리
- **비용 효율**: 종량제로 초기 비용 낮음 (사용한 만큼만)
- **마이그레이션 불필요**: 로컬 → S3 마이그레이션 작업 회피
- **Storage 추상화**: boto3 라이브러리로 Storage 인터페이스 구현
  ```python
  from abc import ABC, abstractmethod

  class StorageInterface(ABC):
      @abstractmethod
      async def upload(self, file_path: str, content: bytes) -> str:
          pass

      @abstractmethod
      async def download(self, file_path: str) -> bytes:
          pass

  class S3Storage(StorageInterface):
      # S3 구현
  ```

---

## 질문 2: 엔티티 연결을 어떻게 구현할 것인가?

### 질문
Document가 Client, Assessment, CounselingSession 등 여러 엔티티에 연결되어야 한다. 어떤 방식으로 구현할 것인가?

### 옵션

#### 옵션 A: Polymorphic Association (entity_type + entity_id)
```python
class Document(Base):
    entity_type: Mapped[str]  # "client", "assessment", ...
    entity_id: Mapped[int]
```
- **장점**:
  - 유연성 (새 엔티티 추가 시 스키마 변경 불필요)
  - 단순한 구조 (컬럼 2개만)
- **단점**:
  - 외래키 제약 없음 (참조 무결성 보장 안됨)
  - 타입 안전성 낮음 (entity_type 오타 가능)
  - Join 복잡 (CASE 문 필요)

#### 옵션 B: 각 엔티티별 별도 테이블
```python
class ClientDocument(Base):
    client_id: Mapped[int] = ForeignKey("clients.id")

class AssessmentDocument(Base):
    assessment_id: Mapped[int] = ForeignKey("assessments.id")
```
- **장점**:
  - 외래키 제약 (참조 무결성 보장)
  - 타입 안전성
  - 단순한 Join
- **단점**:
  - 중복된 테이블 (N개 엔티티 = N개 테이블)
  - 새 엔티티 추가 시 마이그레이션 필요
  - 통합 조회 복잡 (UNION 필요)

### 결정
**옵션 A: Polymorphic Association**

### 근거
- **확장성 우선**: 새 도메인 추가 시 Document 모듈 수정 불필요
- **단순성**: 컬럼 2개로 해결, 마이그레이션 부담 없음
- **참조 무결성 대응**:
  - 어플리케이션 레벨에서 검증 (Handler에서 entity 존재 확인)
  - 삭제 시 CASCADE 동작은 어플리케이션에서 처리
  - entity_type은 Enum으로 관리하여 오타 방지
  ```python
  class EntityType(str, Enum):
      CLIENT = "client"
      ASSESSMENT = "assessment"
      COUNSELING_SESSION = "counseling_session"
  ```
- **실제 사례**: Rails ActiveRecord, Django ContentTypes 등 검증된 패턴

---

## 질문 3: 버전 관리를 어떻게 구현할 것인가?

### 질문
파일 수정 시 이전 버전을 어떻게 관리할 것인가?

### 옵션

#### 옵션 A: 단순 덮어쓰기 (버전 관리 없음)
- **장점**: 구현 간단, 저장 공간 절약
- **단점**: 이전 버전 복구 불가, 감사 추적 어려움

#### 옵션 B: Git 스타일 버전 관리 (diff 저장)
- **장점**: 저장 공간 효율 (변경된 부분만 저장)
- **단점**: 구현 복잡, 바이너리 파일에 비효율적

#### 옵션 C: 전체 파일 버전 저장 (Immutable Versions)
```python
class DocumentVersion(Base):
    document_id: Mapped[int]
    version_number: Mapped[int]
    storage_path: Mapped[str]  # S3 키
```
- **장점**:
  - 구현 간단 (각 버전은 독립적)
  - 빠른 버전 조회 및 다운로드
  - 바이너리 파일에 적합
  - S3 versioning과 통합 가능
- **단점**:
  - 저장 공간 많이 사용

### 결정
**옵션 C: 전체 파일 버전 저장 (최대 50개 버전)**

### 근거
- **바이너리 파일 중심**: PDF, 이미지 등 diff 비효율적
- **빠른 조회 성능**: 버전 복원 시 추가 연산 불필요
- **S3 적합성**: 각 버전은 별도 S3 키로 저장
  - `centers/123/documents/456/v1/original.pdf`
  - `centers/123/documents/456/v2/updated.pdf`
- **감사 추적 완벽성**: 모든 버전 온전히 보관
- **저장 공간 관리**:
  - 최대 50개 버전 제한
  - **오래된 버전부터 자동 삭제 (버전 1 제외)**
  - S3 Lifecycle Policy로 자동 아카이브 가능

---

## 질문 4: 버전 자동 삭제 정책은 무엇인가?

### 질문
버전 수 제한(50개) 초과 시 어떤 버전을 삭제할 것인가?

### 옵션

#### 옵션 A: 가장 오래된 버전 삭제 (FIFO)
- **장점**: 단순한 로직, 예측 가능
- **단점**: 중요한 초기 버전(예: 원본) 삭제 가능

#### 옵션 B: 접근 빈도 기반 삭제 (LRU)
- **장점**: 자주 사용되는 버전 보존
- **단점**: 구현 복잡, 접근 로그 분석 필요

### 결정
**옵션 A 변형: 가장 오래된 버전 삭제 (단, 버전 1은 항상 보존)**

### 근거
- **단순성 우선**: 구현 및 테스트 용이
- **초기 버전 보호**: 버전 1(원본)은 영구 보존
  ```python
  # 51번째 버전 업로드 시
  versions_to_delete = (
      session.query(DocumentVersion)
      .filter(DocumentVersion.document_id == doc_id)
      .filter(DocumentVersion.version_number > 1)  # 버전 1 제외
      .order_by(DocumentVersion.version_number.asc())
      .limit(1)
  )
  ```
- **용량 관리 명확성**: 50개 = 약 2.5GB (파일당 50MB * 50)
- **S3 Lifecycle**: 추후 S3 Glacier로 자동 아카이브 가능

---

## 질문 5: 파일 타입 검증을 어떻게 할 것인가?

### 질문
업로드된 파일의 타입을 어떻게 검증할 것인가?

### 옵션

#### 옵션 A: 파일 확장자만 검증
- **장점**: 구현 간단, 빠름
- **단점**: 확장자 변조 가능 (exe → pdf 변경)
- **보안 위험**: 악성 파일 업로드 가능

#### 옵션 B: MIME type 검증 (Content-Type 헤더)
- **장점**: 브라우저 자동 제공, 구현 간단
- **단점**: 클라이언트가 조작 가능
- **보안 위험**: 여전히 우회 가능

#### 옵션 C: Magic Bytes 검증 (파일 시그니처)
```python
# PDF 예시: 파일 시작이 %PDF-
with open(file_path, 'rb') as f:
    header = f.read(4)
    if header != b'%PDF':
        raise ValueError("Invalid PDF file")
```
- **장점**: 실제 파일 내용 검증, 확장자 변조 무효
- **단점**: 모든 타입의 시그니처 DB 유지 필요
- **보안**: 높은 수준 보장

### 결정
**옵션 B: MIME type + 확장자 검증 (허용 리스트 방식)**

### 근거
- **실용성**: 대부분의 정상 사용 케이스 커버
- **단순성**: FastAPI `UploadFile.content_type` 활용
- **허용 리스트**:
  ```python
  ALLOWED_MIME_TYPES = {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
  }
  ```
- **보안 수준**: 상담센터 업무 환경에서 충분
- **확장 가능**: 추후 Magic Bytes 검증 추가 가능 (Phase 2)

---

## 질문 6: 접근 제어를 어떻게 구현할 것인가?

### 질문
누가 어떤 문서에 접근할 수 있는지 어떻게 결정할 것인가?

### 옵션

#### 옵션 A: 센터 기반 접근 제어 (Center-based)
- **규칙**: 같은 center_id의 CenterMember면 모두 접근 가능
- **장점**: 단순, 대부분의 케이스 커버
- **단점**: 세밀한 권한 관리 불가 (작성자만 볼 수 있는 문서 불가)

#### 옵션 B: 역할 기반 접근 제어 (RBAC)
- **규칙**: 역할(admin, counselor, staff)에 따라 권한 부여
- **장점**: 역할별 권한 분리 명확
- **단점**: 문서마다 역할 설정 필요, 관리 복잡

#### 옵션 C: Access Level (계층적 접근 수준)
- **규칙**: 단일 Enum 필드로 접근 범위 표현
  - `private` → 작성자만 접근
  - `center` → 작성자 + 센터 멤버 전체
  - `public` → 외부 공유 가능 (서명된 URL)
- **장점**:
  - 단일 필드로 모든 케이스 표현
  - 상호 배타적 (모순 상태 불가능)
  - 확장 용이 (추후 `shared` 등 추가 가능)
- **단점**: 특정 사용자 지정 공유는 추가 테이블 필요

### 결정
**옵션 C: Access Level (계층적 접근 수준)**

### 근거
- **멀티테넌트 우선**: 센터 간 격리가 최우선
- **센터 내 세밀한 권한**: 작성자만 볼 수 있는 문서 지원
- **단일 필드**: `is_public` boolean 대신 `access_level` Enum 사용
  - 모순 상태 불가능 (`is_private=True, is_public=True` 같은 상황 방지)
  - 쿼리 단순: `WHERE access_level = 'private'`
- **확장 가능**: 추후 `shared` (초대된 사람만) 레벨 추가 시 Enum 값만 추가
- **스키마**:
  ```python
  class AccessLevel(str, Enum):
      PRIVATE = "private"    # 작성자만
      CENTER = "center"      # 작성자 + 센터 멤버 전체
      PUBLIC = "public"      # 외부 공유 가능

  class Document(Base):
      access_level: Mapped[str] = mapped_column(String(20), default="center")
  ```
- **검증 로직**:
  ```python
  async def check_document_access(
      document: Document,
      account: Account,
      center_member: CenterMember | None
  ) -> bool:
      # 1. 작성자는 항상 접근 가능
      if document.uploader_id == account.id:
          return True

      # 2. Access Level별 검증
      match document.access_level:
          case AccessLevel.PRIVATE:
              return False

          case AccessLevel.CENTER:
              return (
                  center_member is not None
                  and center_member.center_id == document.center_id
              )

          case AccessLevel.PUBLIC:
              # 서명된 URL로 접근 (별도 처리)
              return True
  ```

---

## 질문 7: 외부 공유 URL을 어떻게 구현할 것인가?

### 질문
`access_level=public`인 문서를 외부에 공유할 때 어떤 방식을 사용할 것인가?

### 옵션

#### 옵션 A: S3 Pre-signed URL
```python
s3_client.generate_presigned_url(
    'get_object',
    Params={'Bucket': bucket, 'Key': key},
    ExpiresIn=3600
)
```
- **장점**: AWS 네이티브, Stateless, 자동 만료
- **단점**: S3 직접 노출, 다운로드 횟수 제한 불가

#### 옵션 B: JWT 서명된 URL + Proxy
```python
# JWT 토큰 생성
token = jwt.encode({
    "document_id": 123,
    "exp": datetime.utcnow() + timedelta(hours=24)
}, SECRET_KEY)

# API 엔드포인트로 다운로드
# GET /documents/123/download?token={token}
# → 서버에서 S3 다운로드 후 Proxy
```
- **장점**: 접근 로그 기록, S3 숨김, 추가 검증 가능
- **단점**: 서버 트래픽 증가, 메모리 사용

#### 옵션 C: 비밀번호 보호 공유
```python
class DocumentShare(Base):
    token: Mapped[str]  # UUID
    document_id: Mapped[int]
    password_hash: Mapped[str | None]  # bcrypt
    expires_at: Mapped[datetime]
```
- **장점**: 보안 강화 (비밀번호 입력 필요)
- **단점**: UX 복잡, 추가 테이블 필요

### 결정
**옵션 B + 옵션 C 조합: JWT 서명된 URL + 선택적 비밀번호 보호**

### 근거
- **보안 우선**: S3 URL 직접 노출 방지
- **감사 추적**: 모든 다운로드 DocumentAccess 로그 생성
- **유연성**: 비밀번호 보호는 선택 사항
- **구현**:
  ```python
  async def create_share_link(
      document_id: int,
      expires_in_hours: int,
      password: str | None = None
  ):
      payload = {
          "document_id": document_id,
          "exp": datetime.utcnow() + timedelta(hours=expires_in_hours)
      }
      if password:
          payload["password_required"] = True
          # 비밀번호 해시는 DB에 저장

      token = jwt.encode(payload, SECRET_KEY)
      return f"https://app.example.com/shared/{token}"
  ```
- **다운로드 플로우**:
  1. 사용자가 공유 링크 접속
  2. JWT 검증 (만료, 서명)
  3. 비밀번호 요구 시 입력 화면
  4. 서버에서 S3 다운로드 → 사용자에게 전달
  5. DocumentAccess 로그 생성

---

## 질문 8: 대용량 파일을 어떻게 처리할 것인가?

### 질문
50MB 제한을 넘는 파일 업로드를 지원해야 하는가?

### 옵션

#### 옵션 A: 제한 유지 (50MB)
- **장점**: 서버 부하 최소화, 구현 간단
- **단점**: 동영상, 고화질 스캔 파일 업로드 불가

#### 옵션 B: 제한 상향 (100MB, 200MB)
- **장점**: 대부분의 파일 커버
- **단점**: 서버 메모리 압박, 업로드 시간 증가

#### 옵션 C: S3 Multipart Upload
```python
# 5MB 청크로 분할 업로드
s3_client.create_multipart_upload(...)
for part in chunks:
    s3_client.upload_part(...)
s3_client.complete_multipart_upload(...)
```
- **장점**: 대용량 파일 지원 (최대 5TB), 재시도 가능
- **단점**: 구현 복잡, 프론트엔드도 지원 필요

### 결정
**옵션 A: 50MB 제한 유지 (동영상 필요 시 확장)**

### 근거
- **실제 사용 패턴 확인 필요**: 초기에는 50MB로 충분한지 검증
- **서버 안정성 우선**: 대용량 파일은 서버 메모리 압박
- **S3 적합성**: S3는 대용량 지원하지만, 서버 업로드 처리 부담
- **확장 가능**:
  - 동영상 필요 시 Phase 2에서 Multipart Upload 추가
  - 플랜별 차등: Free (10MB), Pro (50MB), Enterprise (500MB)
- **현재 판단**: 문서/이미지 중심 업무에서 50MB면 충분
  - PDF: 100페이지 = 약 10MB
  - 고화질 이미지: 5000x3000 JPEG = 약 10MB
  - 스캔 문서: 50페이지 = 약 30MB

---

## 질문 9: 문서 메타데이터를 어떻게 확장할 것인가?

### 질문
태그, 카테고리 등 추가 메타데이터가 필요한가?

### 옵션

#### 옵션 A: 메타데이터 없음 (현재 설계)
- **장점**: 단순, 빠른 구현
- **단점**: 검색/분류 기능 제한적

#### 옵션 B: JSON 필드 (metadata JSONB)
```python
class Document(Base):
    metadata: Mapped[dict] = mapped_column(JSONB, nullable=True)
```
- **장점**: 유연한 확장, 스키마 변경 불필요
- **단점**: 쿼리 성능 낮음, 인덱싱 어려움

#### 옵션 C: 카테고리 Enum
```python
class DocumentCategory(str, Enum):
    CONTRACT = "contract"  # 계약서
    CONSENT = "consent"    # 동의서
    REPORT = "report"      # 보고서
    TEST_RESULT = "test_result"  # 검사 결과
    COUNSELING_RECORD = "counseling_record"  # 상담 기록
    OTHER = "other"
```
- **장점**: 타입 안전, 고정된 분류, 필터링 쉬움
- **단점**: 유연성 낮음, Enum 변경 시 마이그레이션

### 결정
**옵션 C: 카테고리 Enum (선택적 필드)**

### 근거
- **실제 사용 패턴**: 상담센터는 문서 종류가 어느 정도 고정적
- **검색 효율**: Enum 필터링이 JSONB보다 빠름
  ```python
  # 카테고리별 문서 조회
  SELECT * FROM documents
  WHERE center_id = 123
  AND category = 'consent'
  AND deleted_at IS NULL
  ```
- **타입 안전성**: 프론트엔드와 Enum 공유
- **유연성 보완**: category=NULL (미지정) 허용
- **확장 가능**: 추후 태그 시스템 필요 시 별도 테이블 추가
  ```python
  class Document(Base):
      category: Mapped[str | None] = mapped_column(String(50), nullable=True)
  ```

---

## 질문 10: 파일 무결성을 어떻게 보장할 것인가?

### 질문
업로드된 파일이 손상되지 않았음을 어떻게 검증할 것인가?

### 옵션

#### 옵션 A: 체크섬 없음
- **장점**: 구현 간단
- **단점**: 파일 손상 감지 불가

#### 옵션 B: MD5 해시
- **장점**: 빠름, 구현 간단
- **단점**: 충돌 가능성, 보안 용도 부적합

#### 옵션 C: SHA-256 해시
```python
import hashlib

def calculate_checksum(file_path):
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()
```
- **장점**: 충돌 거의 없음, 보안 표준
- **단점**: MD5보다 느림 (하지만 허용 가능)

#### 옵션 D: S3 ETag + SHA-256
- **장점**: S3 자체 무결성 검증 + 추가 검증
- **단점**: 복잡도 증가

### 결정
**옵션 C: SHA-256 해시**

### 근거
- **업계 표준**: Git, Docker 등 주요 시스템 사용
- **충돌 방지**: 사실상 불가능한 충돌 확률 (2^256)
- **중복 파일 감지**: 동일 체크섬 = 동일 파일
  ```python
  # 업로드 전 중복 확인
  existing = session.query(DocumentVersion).filter_by(
      checksum=new_checksum
  ).first()

  if existing:
      # 기존 파일 재사용 (S3 복사 대신 storage_path 공유)
  ```
- **다운로드 검증**: 클라이언트도 체크섬 계산하여 손상 여부 확인
- **S3 통합**: S3 ETag와 함께 사용 (이중 검증)
- **성능**: 50MB 파일 해싱에 1초 미만 (허용 가능)

---

## 질문 11: 문서 삭제를 어떻게 처리할 것인가?

### 질문
삭제된 문서의 파일은 즉시 삭제할 것인가, 보관 기간을 둘 것인가?

### 옵션

#### 옵션 A: Soft Delete + S3 파일 즉시 삭제
- **장점**: 저장 공간 즉시 확보, S3 비용 절감
- **단점**: 복구 불가 (실수 삭제 시 문제)

#### 옵션 B: Soft Delete + S3 파일 30일 보관
```python
class Document(Base):
    deleted_at: Mapped[datetime | None]
    # S3 파일은 deleted_at + 30일 후 자동 삭제 (Lifecycle Policy)
```
- **장점**: 복구 기간 제공, 안전
- **단점**: S3 비용 추가 (30일간)

#### 옵션 C: S3 Versioning + Lifecycle
- **장점**: S3 자체 버전 관리 활용
- **단점**: DB 버전과 중복 관리, 복잡도 증가

### 결정
**옵션 B: Soft Delete + S3 Lifecycle Policy (30일 보관)**

### 근거
- **사용자 안전성**: 실수 삭제 시 복구 가능 (30일 내)
- **S3 Lifecycle 활용**:
  ```json
  {
    "Rules": [
      {
        "Id": "delete-marked-documents",
        "Status": "Enabled",
        "Prefix": "centers/",
        "Tags": [{"Key": "deleted", "Value": "true"}],
        "Expiration": {"Days": 30}
      }
    ]
  }
  ```
- **구현 방식**:
  1. 삭제 요청 → DB의 deleted_at 설정
  2. S3 객체에 `deleted=true` 태그 추가
  3. S3 Lifecycle이 30일 후 자동 삭제
- **복구 API**:
  ```python
  async def restore_document(document_id: int):
      document = await repo.get(document_id)
      if document.deleted_at:
          # deleted_at를 NULL로, S3 태그 제거
          document.deleted_at = None
          # S3 태그 삭제
          s3_client.delete_object_tagging(...)
  ```
- **비용**: 30일간 소량 추가 비용 (보험 비용)

---

## 질문 12: 동시 업로드 제어를 어떻게 할 것인가?

### 질문
같은 사용자가 동시에 여러 파일을 업로드하거나, 같은 문서에 여러 버전을 동시에 업로드하려 할 때 어떻게 처리할 것인가?

### 옵션

#### 옵션 A: 제한 없음
- **장점**: 사용자 편의성
- **단점**: 서버 리소스 고갈, DoS 공격 가능

#### 옵션 B: 계정당 동시 업로드 수 제한 (5개)
```python
# Redis로 카운터 관리
uploads = redis.incr(f"uploads:{account_id}:count")
if uploads > 5:
    raise TooManyUploadsError()
```
- **장점**: 서버 보호, 간단한 구현
- **단점**: 정당한 사용자도 제한 받을 수 있음

#### 옵션 C: 문서당 Lock (동시 버전 업로드 방지)
```python
# DB Row Lock
document = session.query(Document).with_for_update().get(id)
# 버전 번호 증가 및 저장
```
- **장점**: 버전 번호 충돌 방지
- **단점**: DB Lock으로 성능 저하 가능

### 결정
**옵션 B (동시 5개) + 옵션 C (버전 Lock)**

### 근거
- **서버 보호 우선**: 동시 업로드는 메모리/CPU 압박
- **합리적 제한**: 일반 사용자는 5개 동시 업로드면 충분
- **버전 충돌 방지**: 같은 문서에 동시 버전 업로드 시 Lock
  ```python
  async def create_new_version(document_id: int, file: UploadFile):
      async with uow:
          # Row Lock 획득
          document = await repo.get_with_lock(document_id)

          # 버전 번호 계산 (Race Condition 방지)
          next_version = document.version_count + 1

          # S3 업로드
          storage_path = await s3.upload(...)

          # 새 버전 생성
          version = await version_repo.create({
              "document_id": document_id,
              "version_number": next_version,
              "storage_path": storage_path
          })

          # Document 업데이트
          document.version_count = next_version
          document.current_version_id = version.id

          await uow.commit()
  ```

---

## Question 13: 권한이 없는 사용자가 문서의 어디까지 접근할 수 있나?

### 배경

`access_level`이 `private`이거나 `center`인 문서에 대해 권한이 없는 사용자가 접근을 시도할 때, 어떤 정보까지 노출해야 하는지 결정이 필요하다.

**고려 사항**:
- 보안: 문서 존재 여부 자체가 민감한 정보일 수 있음
- 사용성: 명확한 오류 메시지가 사용자 경험에 도움
- 정보 노출: 메타데이터(제목, 작성자 등) 노출 범위

### Option A: 존재 여부 숨김 (404 일관 반환)

권한이 없는 문서에 대해 "문서를 찾을 수 없습니다" (404) 반환

```python
async def get_document(document_id: int, current_user: User):
    document = await repo.get(document_id)

    if not document:
        raise HTTPException(404, "문서를 찾을 수 없습니다")

    if not has_access(document, current_user):
        # 존재 여부 숨김
        raise HTTPException(404, "문서를 찾을 수 없습니다")

    return document
```

**장점**:
- 문서 존재 여부 자체를 보호
- 보안 수준 최대화

**단점**:
- 사용자가 권한 문제인지 잘못된 링크인지 구분 불가
- 권한 요청 흐름 구현 어려움

### Option B: 존재 여부 노출 + 메타데이터 숨김 (403 반환)

권한이 없으면 "접근 권한이 없습니다" (403) 반환, 메타데이터 미노출

```python
async def get_document(document_id: int, current_user: User):
    document = await repo.get(document_id)

    if not document:
        raise HTTPException(404, "문서를 찾을 수 없습니다")

    if not has_access(document, current_user):
        raise HTTPException(403, "이 문서에 접근할 권한이 없습니다")

    return document
```

**장점**:
- 사용자가 권한 문제임을 인지 가능
- 권한 요청 흐름 연계 가능

**단점**:
- 문서 존재 여부 노출

### Option C: 존재 여부 노출 + 최소 메타데이터 노출

권한이 없으면 403과 함께 최소한의 메타데이터(제목, 작성자) 반환

```python
async def get_document(document_id: int, current_user: User):
    document = await repo.get(document_id)

    if not document:
        raise HTTPException(404, "문서를 찾을 수 없습니다")

    if not has_access(document, current_user):
        raise HTTPException(
            403,
            detail={
                "message": "이 문서에 접근할 권한이 없습니다",
                "document": {
                    "id": document.id,
                    "title": document.title,
                    "author_name": document.author.name,
                    "access_level": document.access_level
                }
            }
        )

    return document
```

**장점**:
- 어떤 문서인지 확인 가능
- 권한 요청 시 맥락 제공

**단점**:
- 제목/작성자 정보 노출
- 민감한 제목의 경우 정보 유출 위험

### Option D: access_level에 따른 차등 처리

`private` → 404 (존재 숨김)
`center` → 403 + 최소 메타데이터 (같은 센터지만 권한 없음)
`public` (만료/비활성) → 403 + 메타데이터

```python
async def get_document(document_id: int, current_user: User):
    document = await repo.get(document_id)

    if not document:
        raise HTTPException(404, "문서를 찾을 수 없습니다")

    access_result = check_access(document, current_user)

    if not access_result.has_access:
        if document.access_level == "private":
            # private 문서는 존재 자체를 숨김
            raise HTTPException(404, "문서를 찾을 수 없습니다")

        elif document.access_level == "center":
            if access_result.same_center:
                # 같은 센터지만 권한 없음 (향후 확장 대비)
                raise HTTPException(403, {
                    "message": "이 문서에 접근할 권한이 없습니다",
                    "document": {"id": document.id, "title": document.title}
                })
            else:
                # 다른 센터 → 존재 숨김
                raise HTTPException(404, "문서를 찾을 수 없습니다")

        elif document.access_level == "public":
            # public인데 접근 불가 (만료/비활성)
            raise HTTPException(403, {
                "message": "공유 링크가 만료되었거나 비활성화되었습니다",
                "document": {"id": document.id, "title": document.title}
            })

    return document
```

**장점**:
- access_level 의도에 맞는 노출 수준
- private은 최대 보안, public은 사용성 중시
- 향후 권한 요청 흐름에 유연하게 대응

**단점**:
- 구현 복잡도 증가
- 일관성 없는 응답 형식

### 결정: Option C (존재 여부 노출 + 최소 메타데이터 노출)

**근거**:
1. **사용자 경험**: 권한이 없을 때 어떤 문서인지 알 수 있어 맥락 파악 용이
2. **권한 요청 흐름**: 메타데이터가 있어야 "이 문서에 대한 접근 권한 요청" 기능 구현 가능
3. **일관성**: 모든 access_level에 대해 동일한 응답 형식 유지
4. **단순성**: 조건 분기 없이 일관된 처리 로직

**권한 없는 사용자 응답 정리**:

| 상황 | 응답 | 노출 정보 |
|------|------|----------|
| 문서 미존재 | 404 | 없음 |
| 권한 없음 (모든 access_level) | 403 + 메타데이터 | id, title, author_name, access_level |

---

## 요약

| 질문 | 결정 | 근거 |
|------|------|------|
| 저장소 선택 | AWS S3 (처음부터) | 확장성, 운영 부담 최소화, 마이그레이션 회피 |
| 엔티티 연결 | Polymorphic (entity_type + entity_id) | 확장성, 단순성, Enum으로 타입 안전성 보완 |
| 버전 관리 | 전체 파일 저장 (최대 50개) | 바이너리 파일, 빠른 조회, S3 적합 |
| 버전 삭제 | 오래된 것부터 (버전 1 제외) | 단순성, 초기 버전 보호 |
| 파일 타입 검증 | MIME + 확장자 (허용 리스트) | 실용성, 단순성, 충분한 보안 |
| 접근 제어 | Access Level (private/center/public) | 멀티테넌트, 센터 내 세밀한 권한, 확장 용이 |
| 외부 공유 | JWT + 비밀번호 보호 옵션 | 보안, 감사 추적, 유연성 |
| 대용량 파일 | 50MB 제한 (필요 시 확장) | 서버 안정성, 실제 패턴 확인 |
| 메타데이터 | 카테고리 Enum (선택적) | 타입 안전, 검색 효율, 고정된 분류 |
| 무결성 검증 | SHA-256 체크섬 | 업계 표준, 충돌 방지, 중복 감지 |
| 삭제 처리 | Soft Delete + S3 30일 보관 | 복구 가능, S3 Lifecycle 활용 |
| 동시 업로드 | 동시 5개 + 버전 Lock | 서버 보호, 버전 충돌 방지 |
| 비인가 접근 응답 | 403 + 최소 메타데이터 | 일관성, 권한 요청 흐름 지원, 단순성 |
