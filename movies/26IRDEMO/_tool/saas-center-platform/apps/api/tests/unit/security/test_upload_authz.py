"""UP-IDOR 회귀: 이미지 업로드/삭제는 대상 center 멤버십을 요구한다.
이전엔 delete 가 임의 path 로 아무 S3 객체나 삭제, upload 가 임의 entity_id prefix 에 write 가능했다."""
import pytest
from fastapi import HTTPException

from app.application.handlers.upload.delete_image_app import delete_image_app_handler
from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork


async def test_delete_rejects_non_member(test_session):
    uow = UnitOfWork(test_session)
    # center-X 에 대한 멤버가 아니므로 _resolve_access 가 403
    with pytest.raises(HTTPException) as exc:
        await delete_image_app_handler(
            path="center-logo/center-X/img.png",
            person_id="not-a-member",
            uow=uow,
        )
    assert exc.value.status_code == 403


async def test_delete_rejects_malformed_path(test_session):
    uow = UnitOfWork(test_session)
    with pytest.raises(InvalidOperationException):
        await delete_image_app_handler(
            path="garbage", person_id="p1", uow=uow
        )


async def test_delete_rejects_unknown_category(test_session):
    uow = UnitOfWork(test_session)
    with pytest.raises(InvalidOperationException):
        await delete_image_app_handler(
            path="bogus-cat/center-X/img.png", person_id="p1", uow=uow
        )
