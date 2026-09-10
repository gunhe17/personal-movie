# Document 도메인 엣지 케이스

## 1. 동시 파일 업데이트 (Race Condition)

### 상황
같은 문서에 대해 2명의 사용자가 동시에 새 버전을 업로드하려고 시도.

**v3.0 설계에서의 변화**:
- DocumentVersion 테이블 제거
- S3 Versioning이 자동으로 버전 관리
- 동일한 S3 Key로 PUT 요청 시 S3가 자동으로 새 버전 생성
- **핵심**: 동시 업로드 시 S3에는 2개의 버전이 모두 생성되지만, DB의 Document 레코드는 마지막 업데이트만 반영됨

**시나리오**:
```
T0: Document 123 (file_size = 1MB, checksum = "abc123")
T1: 사용자 A가 새 버전 업로드 시작 (2MB, checksum = "def456")
T2: 사용자 B가 새 버전 업로드 시작 (3MB, checksum = "ghi789")
T3: A의 S3 업로드 완료 → S3 Version ID = v2-aaa
T4: B의 S3 업로드 완료 → S3 Version ID = v3-bbb
T5: A의 DB 업데이트 → file_size = 2MB, checksum = "def456"
T6: B의 DB 업데이트 → file_size = 3MB, checksum = "ghi789" (A의 업데이트 덮어씀)
```

### 전략 A: DB Row Lock (Pessimistic Locking)

**구현**:
```python
async def update_document_handler(
    document_id: int,
    file: UploadFile,
    change_note: str | None,
    account: Account,
    uow: UnitOfWork
):
    async with uow:
        # Row Lock 획득 (다른 트랜잭션은 대기)
        document = await document_repo.get_with_lock(document_id)

        # 체크섬 계산
        checksum = calculate_sha256(file)

        # S3 업로드 (같은 Key → S3가 자동으로 새 버전 생성)
        await s3_client.put_object(
            Bucket='imomtae-documents',
            Key=document.storage_path,  # 고정된 경로
            Body=file.file,
            Metadata={
                'uploaded-by': str(account.id),
                'change-note': change_note or ''
            }
        )

        # Document 메타데이터 업데이트
        document.file_type = file.content_type
        document.file_size = file.size
        document.checksum = checksum
        document.name = file.filename
        await document_repo.update(document)

        await uow.commit()  # Lock 해제
```

**장점**:
- 충돌 원천 차단 (확실한 해결)
- Document 메타데이터 일관성 보장
- 구현 단순

**단점**:
- Lock 대기 시간 증가 (업로드 중 Lock 유지)
- 대용량 파일 업로드 시 Lock 오래 유지
- DB 성능 저하 가능

**S3 동작**:
- Lock으로 인해 순차적으로 업로드되더라도, S3에는 2개의 버전이 모두 저장됨
- 버전 히스토리 조회 시 두 버전 모두 확인 가능

### 전략 B: Optimistic Locking (메타데이터 체크)

**구현**:
```python
async def update_document_handler(
    document_id: int,
    file: UploadFile,
    change_note: str | None,
    account: Account,
    uow: UnitOfWork
):
    # Lock 없이 Document 조회
    document = await document_repo.get(document_id)
    expected_checksum = document.checksum

    # 체크섬 계산
    new_checksum = calculate_sha256(file)

    # S3 업로드 (Lock 없이 진행)
    await s3_client.put_object(
        Bucket='imomtae-documents',
        Key=document.storage_path,
        Body=file.file,
        Metadata={
            'uploaded-by': str(account.id),
            'change-note': change_note or ''
        }
    )

    async with uow:
        # 트랜잭션 시작 후 checksum 재확인
        current_document = await document_repo.get(document_id)

        if current_document.checksum != expected_checksum:
            # 충돌 감지! S3에는 이미 업로드됨 (버전 보존)
            raise VersionConflictError(
                "Document was modified by another user. "
                "Your version is saved as a previous version in S3."
            )

        # Document 메타데이터 업데이트
        document.file_type = file.content_type
        document.file_size = file.size
        document.checksum = new_checksum
        document.name = file.filename
        await document_repo.update(document)

        await uow.commit()
```

**장점**:
- Lock 없어 성능 좋음
- 대부분의 경우 충돌 없음
- S3에는 모든 버전이 보존됨 (나중에 복구 가능)

**단점**:
- 충돌 시 사용자에게 혼란 (업로드는 성공했지만 메타데이터 업데이트 실패)
- 클라이언트에서 재시도 로직 필요
- S3에 "고아" 버전 생성 가능 (DB에 메타데이터 없음)

### 전략 C: S3 버전 기반 충돌 감지

**구현**:
```python
async def update_document_handler(
    document_id: int,
    file: UploadFile,
    change_note: str | None,
    account: Account,
    uow: UnitOfWork
):
    document = await document_repo.get(document_id)

    # S3 업로드 전 현재 최신 버전 ID 조회
    response = s3_client.list_object_versions(
        Bucket='imomtae-documents',
        Prefix=document.storage_path,
        MaxKeys=1
    )
    expected_version_id = response['Versions'][0]['VersionId']

    # S3 업로드
    put_response = await s3_client.put_object(
        Bucket='imomtae-documents',
        Key=document.storage_path,
        Body=file.file,
        Metadata={
            'uploaded-by': str(account.id),
            'change-note': change_note or '',
            'previous-version': expected_version_id  # 메타데이터에 기록
        }
    )
    new_version_id = put_response['VersionId']

    async with uow:
        # DB 업데이트 시 버전 ID 검증
        current_response = s3_client.list_object_versions(
            Bucket='imomtae-documents',
            Prefix=document.storage_path,
            MaxKeys=2
        )

        if len(current_response['Versions']) > 2:
            # 업로드 사이에 다른 버전이 생성됨 (충돌)
            raise VersionConflictError(
                "Concurrent upload detected. "
                f"Your version (ID: {new_version_id}) is preserved."
            )

        # Document 메타데이터 업데이트
        checksum = calculate_sha256(file)
        document.file_type = file.content_type
        document.file_size = file.size
        document.checksum = checksum
        await document_repo.update(document)

        await uow.commit()
```

**장점**:
- S3 버전 히스토리와 DB 메타데이터 일관성 유지
- 모든 버전이 S3에 보존됨
- 충돌 정확히 감지 가능

**단점**:
- S3 API 호출 증가 (비용, 레이턴시)
- 구현 복잡도 증가
- 충돌 시 사용자 경험 저하

### 전략 비교

| 항목 | 전략 A (DB Lock) | 전략 B (Optimistic) | 전략 C (S3 버전 체크) |
|------|------------------|---------------------|----------------------|
| 충돌 방지 | ✅ 완벽 | ⚠️ 재시도 필요 | ✅ 감지 가능 |
| 성능 | ⚠️ Lock 대기 | ✅ 빠름 | ⚠️ S3 API 오버헤드 |
| 구현 복잡도 | 🟢 단순 | 🟡 중간 | 🔴 복잡 |
| 대용량 파일 | ❌ Lock 오래 유지 | ✅ 문제 없음 | ✅ 문제 없음 |
| 버전 보존 | ✅ S3에 보존 | ✅ S3에 보존 | ✅ S3에 보존 |

### 권장 전략
**Phase 1: 전략 B (Optimistic Locking)**
- 충돌 빈도 낮음 (대부분 다른 문서 업로드)
- 구현 간단, 추가 인프라 불필요
- S3 Versioning으로 모든 버전 보존됨
- 충돌 시 S3 버전 히스토리에서 복구 가능

**Phase 2 (고빈도 충돌 발생 시): 전략 A (DB Lock)**
- 확실한 충돌 방지
- 사용자 경험 개선 (명확한 순서 보장)

---

## 2. 저장소 용량 초과

### 상황
센터의 S3 용량 제한을 초과하는 파일 업로드 시도.

**v3.0 설계에서의 변화**:
- file_size가 Document 테이블에 저장됨 (현재 버전만)
- **주의**: S3에는 과거 버전도 저장되므로, 실제 S3 사용량은 현재 버전 file_size 합계보다 큼
- 용량 계산 시 S3 버전 히스토리 포함 필요

**예시**:
- Pro 플랜: 100GB 제한
- 현재 DB 기준 사용량 (현재 버전만): 80GB
- 실제 S3 사용량 (과거 버전 포함): 95GB
- 업로드 파일: 10GB → 실제로는 105GB가 되어 초과

### 전략 A: 업로드 전 용량 체크 (S3 API 기반)

**구현**:
```python
async def check_storage_quota(center_id: int, file_size: int):
    # S3에서 실제 사용량 계산 (과거 버전 포함)
    actual_usage = await calculate_s3_usage(center_id)

    # 플랜별 제한 조회
    plan = await subscription_service.get_plan(center_id)
    quota_limit = plan.storage_quota_gb * 1024 * 1024 * 1024  # GB → bytes

    # 용량 체크
    if actual_usage + file_size > quota_limit:
        raise StorageQuotaExceededError(
            f"Storage quota exceeded: {actual_usage/1e9:.2f}GB / {quota_limit/1e9:.2f}GB"
        )

async def calculate_s3_usage(center_id: int) -> int:
    """S3에서 센터의 실제 사용량 계산 (모든 버전 포함)"""
    prefix = f"centers/{center_id}/"
    total_size = 0

    # S3 List Object Versions API로 모든 버전 조회
    paginator = s3_client.get_paginator('list_object_versions')
    pages = paginator.paginate(
        Bucket='imomtae-documents',
        Prefix=prefix
    )

    for page in pages:
        for version in page.get('Versions', []):
            total_size += version['Size']

    return total_size

async def upload_document(file: UploadFile, center_id: int, ...):
    # 업로드 전 체크
    await check_storage_quota(center_id, file.size)

    # 업로드 진행
    storage_path = await s3.upload(...)
```

**장점**:
- 정확한 사용량 (과거 버전 포함)
- 불필요한 업로드 방지
- 사용자에게 명확한 오류 메시지

**단점**:
- S3 API 호출 비용 (list_object_versions는 비쌈)
- 성능 저하 (매 업로드마다 S3 조회)
- Race Condition 가능 (동시 업로드 시)

### 전략 B: DB 기반 추정 + 주기적 동기화

**구현**:
```python
# 1. DB에서 빠른 용량 체크 (현재 버전만)
async def check_storage_quota_fast(center_id: int, file_size: int):
    # DB에서 현재 버전 사용량 계산
    current_version_usage = await db.execute(
        """
        SELECT SUM(file_size)
        FROM documents
        WHERE center_id = :center_id
        AND deleted_at IS NULL
        """,
        {"center_id": center_id}
    )

    # 과거 버전 오버헤드 추정 (평균 1.5배)
    estimated_total = current_version_usage * 1.5

    plan = await subscription_service.get_plan(center_id)
    quota_limit = plan.storage_quota_gb * 1024 * 1024 * 1024

    if estimated_total + file_size > quota_limit:
        # 임계값 근처면 정확한 S3 사용량 조회
        if estimated_total + file_size < quota_limit * 1.1:
            actual_usage = await calculate_s3_usage(center_id)
            if actual_usage + file_size > quota_limit:
                raise StorageQuotaExceededError(...)
        else:
            raise StorageQuotaExceededError(...)

# 2. 배치 작업: 매일 1회 정확한 사용량 동기화
async def sync_storage_usage_daily():
    for center in all_centers:
        actual_usage = await calculate_s3_usage(center.id)

        # 캐시 또는 별도 테이블에 저장
        await redis.set(
            f"center:{center.id}:storage_usage",
            actual_usage,
            ex=86400  # 24시간 TTL
        )
```

**장점**:
- 빠른 체크 (DB 쿼리만)
- S3 API 호출 최소화
- 대부분의 경우 정확함

**단점**:
- 과거 버전 오버헤드 추정치가 부정확할 수 있음
- 임계값 근처에서 S3 API 호출 필요
- 캐시 관리 필요

### 전략 C: S3 Lifecycle Policy + 알림

**구현**:
```python
# S3 Lifecycle Policy 설정
lifecycle_config = {
    'Rules': [
        {
            'Id': 'delete-old-versions',
            'Status': 'Enabled',
            'NoncurrentVersionExpiration': {
                'NoncurrentDays': 90  # 90일 지난 과거 버전 자동 삭제
            }
        },
        {
            'Id': 'delete-soft-deleted',
            'Status': 'Enabled',
            'Filter': {
                'Tag': {'Key': 'deleted', 'Value': 'true'}
            },
            'Expiration': {
                'Days': 30  # 30일 후 완전 삭제
            }
        }
    ]
}

# 용량 모니터링 배치 작업 (매일)
async def monitor_storage_usage():
    for center in all_centers:
        actual_usage = await calculate_s3_usage(center.id)
        plan = await subscription_service.get_plan(center.id)
        quota_limit = plan.storage_quota_gb * 1024 * 1024 * 1024

        usage_percentage = (actual_usage / quota_limit) * 100

        # 80% 초과 시 알림
        if usage_percentage >= 80:
            await notify_admin(
                center.id,
                f"Storage usage: {usage_percentage:.1f}% ({actual_usage/1e9:.2f}GB / {quota_limit/1e9:.2f}GB)"
            )

        # 95% 초과 시 업로드 제한
        if usage_percentage >= 95:
            await redis.set(f"center:{center.id}:upload_blocked", "true", ex=86400)
```

**장점**:
- 자동 정리 (S3 Lifecycle)
- 사전 경고 (80% 알림)
- 관리 부담 감소

**단점**:
- 실시간 용량 체크 없음
- 90일 후에야 과거 버전 삭제 (지연)
- 급격한 용량 증가 시 대응 어려움

### 전략 비교

| 항목 | 전략 A (S3 API) | 전략 B (DB 추정) | 전략 C (Lifecycle) |
|------|-----------------|------------------|--------------------|
| 정확성 | ✅ 정확 | ⚠️ 추정치 | ⚠️ 지연 |
| 성능 | ❌ S3 API 느림 | ✅ 빠름 (DB) | ✅ 빠름 |
| 비용 | ❌ S3 API 비용 | 🟢 낮음 | 🟢 낮음 |
| 구현 복잡도 | 🟢 단순 | 🟡 중간 | 🟡 중간 |

### 권장 전략
**Phase 1: 전략 B (DB 추정 + 주기적 동기화)**
- DB에서 빠른 체크 (현재 버전 × 1.5배)
- 임계값 근처에서만 S3 API 호출
- 매일 배치로 정확한 사용량 캐싱

**Phase 2: 전략 C (Lifecycle Policy) 추가**
- 90일 지난 과거 버전 자동 삭제
- 80% 임계값 알림으로 사전 대응

---

## 3. 파일 업로드 중 네트워크 실패

### 상황
50MB 파일 업로드 중 네트워크 끊김 또는 서버 타임아웃.

**v3.0 설계에서의 변화**:
- 변화 없음 (S3 업로드 전략과 무관)
- S3 Versioning은 성공한 업로드만 버전으로 기록

**시나리오**:
```
T0: 클라이언트가 50MB 파일 업로드 시작
T1: 30MB 전송 완료 (60%)
T2: 네트워크 끊김 또는 서버 타임아웃 (120초)
T3: S3에 일부 데이터만 존재 (미완료 업로드)
```

### 전략 A: 단순 재시도 (전체 재업로드)

**구현**:
```python
# 클라이언트
async def upload_with_retry(file, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = await api.post("/documents", files={"file": file})
            return response
        except NetworkError as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)  # 지수 백오프

# 서버
async def upload_document(file: UploadFile, ...):
    try:
        # S3 업로드
        await s3_client.put_object(
            Bucket='imomtae-documents',
            Key=storage_path,
            Body=file.file
        )

        # DB 저장
        await document_repo.create(...)
    except Exception as e:
        # 실패 시 정리 불필요 (S3 업로드 실패 시 버전 생성 안됨)
        logger.error(f"Upload failed: {e}")
        raise
```

**장점**:
- 구현 간단
- 클라이언트만 수정하면 됨
- S3 Versioning과 호환 (실패 시 버전 생성 안됨)

**단점**:
- 대용량 파일 시 재업로드 부담
- 네트워크 대역폭 낭비
- 사용자 경험 나쁨 (느림)

### 전략 B: S3 Multipart Upload (청크 분할)

**구현**:
```python
# 서버
async def create_multipart_upload(document_id: int):
    document = await document_repo.get(document_id)

    upload_id = s3_client.create_multipart_upload(
        Bucket='imomtae-documents',
        Key=document.storage_path
    )
    return {"upload_id": upload_id, "chunk_size": 5 * 1024 * 1024}  # 5MB

async def upload_part(
    document_id: int,
    upload_id: str,
    part_number: int,
    chunk: bytes
):
    document = await document_repo.get(document_id)

    response = s3_client.upload_part(
        Bucket='imomtae-documents',
        Key=document.storage_path,
        UploadId=upload_id,
        PartNumber=part_number,
        Body=chunk
    )
    return {"etag": response['ETag']}

async def complete_multipart_upload(
    document_id: int,
    upload_id: str,
    parts: list
):
    document = await document_repo.get(document_id)

    response = s3_client.complete_multipart_upload(
        Bucket='imomtae-documents',
        Key=document.storage_path,
        UploadId=upload_id,
        MultipartUpload={"Parts": parts}
    )

    # S3 Versioning으로 새 버전 생성됨
    version_id = response['VersionId']

    # DB에 메타데이터 업데이트
    document.file_size = sum(p['Size'] for p in parts)
    document.checksum = calculate_checksum_from_parts(parts)
    await document_repo.update(document)

# 클라이언트
async function uploadLargeFile(file) {
    const chunkSize = 5 * 1024 * 1024;  // 5MB
    const { upload_id } = await api.post(`/documents/${id}/multipart/create`);

    const parts = [];
    for (let i = 0; i < file.size; i += chunkSize) {
        const chunk = file.slice(i, i + chunkSize);
        const partNumber = Math.floor(i / chunkSize) + 1;

        // 실패 시 해당 청크만 재시도
        const { etag } = await uploadPartWithRetry(upload_id, partNumber, chunk);
        parts.push({ PartNumber: partNumber, ETag: etag });
    }

    await api.post(`/documents/${id}/multipart/complete`, { upload_id, parts });
}
```

**장점**:
- 실패 시 해당 청크만 재업로드
- 대용량 파일 지원 (최대 5TB)
- S3 병렬 업로드 가능 (성능 향상)
- S3 Versioning과 호환 (complete 시점에 버전 생성)

**단점**:
- 구현 복잡 (프론트엔드 + 백엔드)
- 미완료 업로드 정리 필요 (abort_multipart_upload)
- 추가 API 엔드포인트 필요

### 전략 비교

| 항목 | 전략 A (단순 재시도) | 전략 B (S3 Multipart) |
|------|----------------------|-----------------------|
| 재업로드 부담 | ❌ 전체 재업로드 | ✅ 청크만 재업로드 |
| 대용량 파일 | ❌ 타임아웃 가능 | ✅ 5TB 지원 |
| 구현 복잡도 | 🟢 단순 | 🔴 복잡 |
| S3 Versioning | ✅ 호환 | ✅ 호환 |

### 권장 전략
**Phase 1: 전략 A (단순 재시도)**
- 50MB 제한에서는 타임아웃 적게 발생
- 네트워크 안정적인 환경 가정

**Phase 2 (대용량 지원 시): 전략 B (S3 Multipart)**
- AWS 네이티브 솔루션
- 검증된 안정성
- S3 Versioning과 자연스럽게 통합

---

## 4. 체크섬 중복 (동일 파일 재업로드)

### 상황
이미 업로드된 파일과 동일한 파일(SHA-256 동일)을 다시 업로드.

**v3.0 설계에서의 변화**:
- checksum이 Document 테이블에 저장됨 (현재 버전만)
- 과거 버전의 checksum은 S3 Object Metadata에 저장 가능
- 중복 제거 시 같은 S3 Key를 공유하는 방식은 S3 Versioning과 충돌

**예시**:
- 문서 A: consent_form.pdf (체크섬: abc123, storage_path: centers/10/documents/1/file.pdf)
- 사용자가 동일한 consent_form.pdf를 문서 B로 업로드 시도

### 전략 A: 중복 허용 (별도 저장)

**구현**:
```python
async def upload_document(file: UploadFile, center_id: int, ...):
    # 체크섬 계산
    checksum = calculate_sha256(file)

    # 중복 체크 없이 S3 업로드
    document_id = generate_id()
    storage_path = f"centers/{center_id}/documents/{document_id}/{uuid.uuid4()}-{file.filename}"

    await s3_client.put_object(
        Bucket='imomtae-documents',
        Key=storage_path,
        Body=file.file,
        Metadata={'checksum': checksum}
    )

    # DB 저장
    await document_repo.create({
        "id": document_id,
        "center_id": center_id,
        "storage_path": storage_path,
        "checksum": checksum,
        "file_size": file.size,
        ...
    })
```

**장점**:
- 구현 단순
- 검증 불필요
- 빠른 업로드
- S3 Versioning과 충돌 없음

**단점**:
- S3 저장 공간 낭비
- 비용 증가

### 전략 B: 체크섬 기반 경고 + 선택적 업로드

**구현**:
```python
async def check_duplicate_file(
    file: UploadFile,
    center_id: int
) -> dict:
    """동일 파일 존재 여부 체크"""
    checksum = calculate_sha256(file)

    # 같은 센터 내에서 동일 체크섬 검색
    existing_documents = await document_repo.find_by_checksum(
        checksum=checksum,
        center_id=center_id
    )

    if existing_documents:
        return {
            "duplicate_found": True,
            "existing_documents": [
                {"id": doc.id, "name": doc.name, "created_at": doc.created_at}
                for doc in existing_documents
            ],
            "message": "Identical file already exists. Continue upload?"
        }

    return {"duplicate_found": False}

async def upload_document_force(
    file: UploadFile,
    center_id: int,
    force: bool = False,
    ...
):
    """force=True 시 중복 경고 무시하고 업로드"""
    if not force:
        duplicate_check = await check_duplicate_file(file, center_id)
        if duplicate_check["duplicate_found"]:
            raise DuplicateFileError(duplicate_check)

    # 업로드 진행 (전략 A와 동일)
    ...
```

**장점**:
- 사용자에게 중복 경고
- 불필요한 업로드 방지 가능
- 최종 결정은 사용자가 함

**단점**:
- 추가 체크 로직 필요
- 클라이언트에서 2단계 업로드 처리
- UX 복잡도 증가

### 전략 C: Client-Side Deduplication (클라이언트 체크)

**구현**:
```typescript
// 클라이언트
async function uploadFile(file: File) {
    // 1. 체크섬 계산 (클라이언트)
    const checksum = await calculateSHA256(file);

    // 2. 중복 체크 API 호출
    const { duplicate_found, existing_documents } = await api.post(
        '/documents/check-duplicate',
        { checksum, center_id }
    );

    // 3. 중복 발견 시 사용자 확인
    if (duplicate_found) {
        const proceed = await confirm(
            `Identical file exists: ${existing_documents[0].name}. Upload anyway?`
        );
        if (!proceed) {
            return { linked: true, document_id: existing_documents[0].id };
        }
    }

    // 4. 업로드 진행
    const result = await api.post('/documents', { file, checksum });
    return result;
}
```

**장점**:
- 네트워크 대역폭 절약 (중복 시 업로드 스킵)
- 빠른 사용자 피드백
- 서버 부하 감소

**단점**:
- 클라이언트 구현 복잡
- 체크섬 계산 시간 (대용량 파일)
- 보안 우려 (클라이언트 체크섬 신뢰 문제)

### 전략 비교

| 항목 | 전략 A (중복 허용) | 전략 B (서버 경고) | 전략 C (클라이언트 체크) |
|------|-------------------|-------------------|-------------------------|
| 저장 공간 | ❌ 낭비 | ⚠️ 사용자 선택 | ⚠️ 사용자 선택 |
| 구현 복잡도 | 🟢 단순 | 🟡 중간 | 🔴 복잡 |
| 업로드 속도 | ✅ 빠름 | ⚠️ 2단계 | ⚠️ 체크섬 계산 |
| S3 Versioning | ✅ 호환 | ✅ 호환 | ✅ 호환 |

### 권장 전략
**Phase 1: 전략 A (중복 허용)**
- 실제 중복 빈도 관찰 필요
- 구현 단순, 안전
- S3 Versioning과 충돌 없음

**Phase 2 (중복 빈도 높음 시): 전략 B (서버 경고)**
- checksum 인덱스 생성으로 빠른 조회
- 사용자에게 선택권 제공
- 불필요한 저장 공간 절약

---

## 5. 삭제된 문서 복구

### 상황
실수로 삭제된 문서를 30일 이내에 복구 요청.

**v3.0 설계에서의 변화**:
- 변화 없음 (Soft Delete 로직 동일)
- S3 파일은 S3 Lifecycle Policy로 30일 보관
- S3 Tag (deleted=true)로 삭제 마킹

**시나리오**:
```
Day 1: 사용자가 문서 123 삭제 → deleted_at = 2024-01-01, S3 Tag 추가
Day 15: 사용자가 복구 요청
```

### 전략 A: 단순 Soft Delete 복구

**구현**:
```python
async def restore_document(document_id: int, account: Account):
    document = await document_repo.get_including_deleted(document_id)

    if not document or not document.deleted_at:
        raise NotFoundError("Document not found or not deleted")

    # 권한 확인
    if document.center_id != account.center_id:
        raise ForbiddenError()

    # 복구 실행
    document.deleted_at = None
    await document_repo.update(document)

    # S3 Tag 제거 (deleted=true → 제거)
    s3_client.delete_object_tagging(
        Bucket='imomtae-documents',
        Key=document.storage_path
    )

    return document
```

**장점**:
- 구현 단순
- 즉시 복구 가능
- S3 파일 자동 유지 (Lifecycle Policy)

**단점**:
- 복구 이력 없음 (누가, 언제 복구했는지)
- 복구 가능 기간 검증 없음

### 전략 B: 복구 기간 검증

**구현**:
```python
async def restore_document(document_id: int, account: Account):
    document = await document_repo.get_including_deleted(document_id)

    if not document or not document.deleted_at:
        raise NotFoundError("Document not found or not deleted")

    # 30일 이내인지 확인
    days_since_deletion = (datetime.utcnow() - document.deleted_at).days
    if days_since_deletion > 30:
        raise RestoreExpiredError(
            "Document can only be restored within 30 days. "
            f"Deleted {days_since_deletion} days ago."
        )

    # S3에 파일 존재 확인 (Lifecycle Policy로 삭제되었을 수 있음)
    try:
        s3_client.head_object(
            Bucket='imomtae-documents',
            Key=document.storage_path
        )
    except s3_client.exceptions.NoSuchKey:
        raise RestoreExpiredError("File no longer exists in storage")

    # 복구 실행
    document.deleted_at = None
    await document_repo.update(document)

    # S3 Tag 제거
    s3_client.delete_object_tagging(
        Bucket='imomtae-documents',
        Key=document.storage_path
    )

    return document
```

**장점**:
- 복구 가능 기간 강제
- S3 파일 존재 검증
- 명확한 에러 메시지

**단점**:
- 복구 이력 없음 (누가, 언제 복구했는지)

### 전략 비교

| 항목 | 전략 A (단순 복구) | 전략 B (기간 검증) |
|------|-------------------|-------------------|
| 구현 복잡도 | 🟢 단순 | 🟢 단순 |
| 기간 검증 | ❌ 없음 | ✅ 30일 제한 |
| S3 검증 | ❌ 없음 | ✅ 파일 존재 확인 |
| 복구 속도 | ✅ 즉시 | ⚠️ S3 API 호출 |

### 권장 전략
**Phase 1: 전략 B (복구 기간 검증)**
- 복구 가능 기간 강제
- S3 파일 존재 검증으로 안정성 향상
- 추가 테이블 불필요

---

## 6. 외부 공유 링크 악용

### 상황
외부 공유 링크가 의도하지 않은 곳에 배포되어 무단 다운로드 발생.

**v3.0 설계에서의 변화**:
- 변화 없음 (공유 링크 로직과 S3 Versioning 독립적)
- 특정 버전 공유 시 Version ID 포함 가능

**예시**:
- 내담자에게 개인적으로 전송한 공유 링크
- 내담자가 SNS에 공유 → 불특정 다수 접근

### 전략 A: 짧은 만료 시간 (1시간) + 접근 로그

**구현**:
```python
async def create_share_link(
    document_id: int,
    version_id: str | None = None,  # 특정 버전 공유 가능
    expires_in_hours: int = 1
):
    document = await document_repo.get(document_id)

    # 기본 1시간, 최대 24시간
    expires_in_hours = min(expires_in_hours, 24)

    payload = {
        "document_id": document_id,
        "version_id": version_id,  # None이면 최신 버전
        "exp": datetime.utcnow() + timedelta(hours=expires_in_hours)
    }
    token = jwt.encode(payload, SECRET_KEY)

    return {
        "share_url": f"https://app.example.com/shared/{token}",
        "expires_at": payload["exp"]
    }

async def download_shared_document(token: str, request: Request):
    payload = jwt.decode(token, SECRET_KEY)

    # 만료 확인
    if datetime.utcnow() > payload["exp"]:
        raise InvalidTokenError("Link expired")

    document = await document_repo.get(payload["document_id"])

    # S3 Pre-signed URL 생성
    download_url = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': 'imomtae-documents',
            'Key': document.storage_path,
            'VersionId': payload.get("version_id")  # 특정 버전 지정 가능
        },
        ExpiresIn=3600  # 1시간
    )

    # 접근 로그 기록
    await document_access_repo.create({
        "document_id": document.id,
        "action": "download_shared",
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent"),
        "version_id": payload.get("version_id")
    })

    return {"download_url": download_url}
```

**장점**:
- 구현 단순
- 자동 만료
- 접근 로그로 추적 가능
- 특정 버전 공유 지원

**단점**:
- 짧은 시간 내에도 악용 가능
- 정당한 사용자도 재요청 필요

### 전략 B: 다운로드 횟수 제한

**구현**:
```python
class ShareToken(Base):
    """공유 토큰 (Stateful)"""
    token: Mapped[str] = unique
    document_id: Mapped[int]
    version_id: Mapped[str | None]  # 특정 버전 공유
    max_downloads: Mapped[int] = default=10
    download_count: Mapped[int] = default=0
    expires_at: Mapped[datetime]

async def download_shared_document(token: str, request: Request):
    share = await share_token_repo.get_by_token(token)

    if not share or share.expires_at < datetime.utcnow():
        raise InvalidTokenError()

    if share.download_count >= share.max_downloads:
        raise MaxDownloadsExceededError(
            f"Maximum downloads ({share.max_downloads}) exceeded"
        )

    # 다운로드 카운터 증가
    share.download_count += 1
    await share_token_repo.update(share)

    # S3 Pre-signed URL 생성
    document = await document_repo.get(share.document_id)
    download_url = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': 'imomtae-documents',
            'Key': document.storage_path,
            'VersionId': share.version_id  # 특정 버전 다운로드
        },
        ExpiresIn=3600
    )

    # 접근 로그
    await document_access_repo.create({
        "document_id": share.document_id,
        "action": "download_shared",
        "ip_address": request.client.host,
        "version_id": share.version_id
    })

    return {"download_url": download_url}
```

**장점**:
- 정확한 다운로드 횟수 제어
- 악용 범위 제한
- 특정 버전 공유 지원

**단점**:
- Stateful (DB 조회 필요)
- 추가 테이블 필요
- JWT의 Stateless 장점 상실

### 전략 비교

| 항목 | 전략 A (짧은 만료) | 전략 B (다운로드 제한) |
|------|-------------------|------------------------|
| 구현 복잡도 | 🟢 단순 | 🟡 중간 |
| 악용 방지 | ⚠️ 제한적 | ✅ 횟수 제한 |
| 사용자 경험 | ✅ 간편 | ✅ 간편 |
| 버전 지원 | ✅ 지원 | ✅ 지원 |

### 권장 전략
**Phase 1: 전략 A (짧은 만료) + 접근 로그**
- 1시간 기본, 최대 24시간
- 모든 접근 DocumentAccess 로그 기록
- 특정 버전 공유 지원 (Version ID)

**Phase 2: 전략 B (다운로드 횟수 제한) 선택 사항**
- 민감한 문서만 횟수 제한 설정

---

## 7. S3 장애 시 대응

### 상황
AWS S3 서비스 장애로 파일 업로드/다운로드 불가.

**v3.0 설계에서의 변화**:
- S3 의존도 증가 (버전 관리도 S3에 위임)
- S3 장애 시 버전 히스토리 조회도 불가

**시나리오**:
```
T0: S3 리전 장애 발생 (us-east-1)
T1: 모든 업로드/다운로드 API 실패
T2: 버전 히스토리 조회도 실패
T3: S3 복구 (3시간 후)
```

### 전략 A: 장애 인지 + 명확한 에러 메시지

**구현**:
```python
async def upload_document(file: UploadFile, ...):
    try:
        storage_path = await s3_client.put_object(...)
        await document_repo.create(...)
    except (BotoCoreError, ClientError) as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "storage_unavailable",
                "message": "File storage service is temporarily unavailable. Please try again later.",
                "retry_after": 300  # 5분 후 재시도
            }
        )

async def list_document_versions(document_id: int):
    try:
        response = s3_client.list_object_versions(...)
        return {"versions": parse_versions(response)}
    except (BotoCoreError, ClientError) as e:
        logger.error(f"S3 list versions failed: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "storage_unavailable",
                "message": "Version history is temporarily unavailable."
            }
        )
```

**장점**:
- 구현 단순
- 명확한 사용자 안내
- 복구 시 자동 정상화

**단점**:
- 장애 중 서비스 불가
- 대안 없음

### 전략 B: 버전 메타데이터 캐싱 (읽기 전용)

**구현**:
```python
# 버전 히스토리 조회 시 Redis 캐싱
async def list_document_versions(document_id: int):
    cache_key = f"document:{document_id}:versions"

    # 1. 캐시 확인
    cached = await redis.get(cache_key)
    if cached:
        return {"versions": json.loads(cached), "cached": True}

    # 2. S3 조회
    try:
        response = s3_client.list_object_versions(
            Bucket='imomtae-documents',
            Prefix=document.storage_path
        )

        versions = parse_versions(response)

        # 3. 캐시 저장 (1시간)
        await redis.setex(cache_key, 3600, json.dumps(versions))

        return {"versions": versions, "cached": False}
    except (BotoCoreError, ClientError) as e:
        # 4. S3 장애 시 오래된 캐시라도 반환
        cached = await redis.get(f"{cache_key}:backup")
        if cached:
            return {
                "versions": json.loads(cached),
                "warning": "Version history may be outdated due to storage service issue"
            }
        raise HTTPException(status_code=503, detail="Version history unavailable")

# 백그라운드 작업: 주기적으로 백업 캐시 갱신
async def refresh_version_cache():
    for document in all_documents:
        try:
            versions = await list_document_versions(document.id)
            await redis.setex(
                f"document:{document.id}:versions:backup",
                86400,  # 24시간
                json.dumps(versions)
            )
        except Exception:
            continue
```

**장점**:
- S3 장애 시에도 버전 히스토리 조회 가능 (캐시)
- 읽기 성능 향상
- 점진적 성능 개선

**단점**:
- Redis 의존성
- 캐시 불일치 가능 (최신 버전 누락)
- 업로드/다운로드는 여전히 불가

### 전략 C: 멀티 리전 복제 (Cross-Region Replication)

**구현**:
```python
# S3 버킷 설정
# Bucket: imomtae-documents-primary (us-east-1)
# Bucket: imomtae-documents-replica (ap-northeast-2)
# Cross-Region Replication 활성화 (S3 Versioning 포함)

async def upload_document(file: UploadFile, ...):
    primary_region = "us-east-1"
    replica_region = "ap-northeast-2"

    try:
        # Primary 리전에 업로드
        response = await s3_client.put_object(
            Bucket='imomtae-documents-primary',
            Key=storage_path,
            Body=file.file
        )
        version_id = response['VersionId']
    except (BotoCoreError, ClientError) as e:
        logger.warning(f"Primary region upload failed: {e}")

        # Replica 리전으로 Failover
        response = await s3_client.put_object(
            Bucket='imomtae-documents-replica',
            Key=storage_path,
            Body=file.file
        )
        version_id = response['VersionId']
        logger.info("Uploaded to replica region")

    # DB에 저장 (버킷 정보 포함 가능)
    await document_repo.create({
        "storage_path": storage_path,
        "version_id": version_id,  # 선택 사항
        ...
    })
```

**장점**:
- 높은 가용성 (리전 장애 대응)
- 자동 Failover
- S3 Versioning도 복제됨
- 지연 시간 최적화 (가까운 리전 사용)

**단점**:
- 비용 2배 (복제 비용 + 저장 비용)
- 복제 지연 (실시간 아님, 수 분~수십 분)
- 복잡도 증가

### 전략 비교

| 항목 | 전략 A (에러 메시지) | 전략 B (캐싱) | 전략 C (멀티 리전) |
|------|---------------------|---------------|-------------------|
| 가용성 | ❌ 장애 시 불가 | ⚠️ 읽기만 가능 | ✅ 높음 |
| 비용 | 🟢 낮음 | 🟡 Redis | 🔴 2배 |
| 구현 복잡도 | 🟢 단순 | 🟡 중간 | 🔴 복잡 |
| 버전 히스토리 | ❌ 불가 | ✅ 캐시 | ✅ 가능 |

### 권장 전략
**Phase 1: 전략 A (에러 메시지)**
- S3 SLA 99.99% (매우 안정적)
- 장애 빈도 낮음
- 명확한 에러 메시지로 사용자 안내

**Phase 2 (읽기 성능 개선): 전략 B (캐싱) 선택 사항**
- 버전 히스토리 조회 캐싱
- S3 장애 시에도 읽기 가능

**Phase 3 (고가용성 필요 시): 전략 C (멀티 리전)**
- 엔터프라이즈 플랜만 지원
- 비용 대비 효과 고려

---

## 구현 우선순위

### Phase 1: 기본 엣지 케이스 대응
- **동시 파일 업데이트**: Optimistic Locking (S3 버전은 모두 보존)
- **저장소 용량 초과**: DB 추정 + 주기적 S3 동기화
- **파일 업로드 실패**: 단순 재시도
- **체크섬 중복**: 중복 허용 (실제 빈도 관찰 후 결정)
- **삭제된 문서 복구**: 기간 검증 (30일) + S3 파일 존재 확인
- **외부 공유 악용**: 짧은 만료 (1시간) + 접근 로그
- **S3 장애**: 명확한 에러 메시지

### Phase 2: 고급 엣지 케이스 대응
- 대용량 파일: S3 Multipart Upload
- 체크섬 중복: 서버 경고 + 사용자 선택
- 외부 공유: 다운로드 횟수 제한 (선택 사항)
- 버전 히스토리: Redis 캐싱 (성능 개선)

### Phase 3: 엔터프라이즈 기능
- 멀티 리전 복제 (Cross-Region Replication)
- S3 Lifecycle Policy 세밀한 조정 (90일 → 사용자 정의)
- 이상 접근 모니터링 및 알림
