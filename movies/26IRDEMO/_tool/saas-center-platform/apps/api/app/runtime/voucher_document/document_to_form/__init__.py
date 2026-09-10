"""document → 서식 페이지 판정 + FormSchema 추출.

페이지 이미지로 빈 제출용 서식을 찾고, lab image-to-form 으로 FormSchema 를 뽑는다.
현재 입력은 PDF.

- 서식 페이지 감지만 = FormPageDetectService.build_units + assemble (voucher runner s3_detect가 소비)
- FormSchema 추출(감지→partition→ground) = DocumentToFormService.execute (독립 온디맨드)
"""
from .page_detect import FormPageDetectService, _clamp_kind
from .schemas import (
    FormDetectionResult,
    FormPage,
    FormPageFailure,
)
from .service import DocumentToFormService

__all__ = [
    "DocumentToFormService",
    "FormPageDetectService",
    "FormDetectionResult",
    "FormPage",
    "FormPageFailure",
    "_clamp_kind",
]
