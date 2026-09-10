"""편집권 계단 회귀: 기록 본문과 첨부는 같은 규칙이다 (설계.md §15-6-4).

07-28 스펙 표가 본문 3행위만 적어, 첨부 3핸들러가 `author != me` 만 보고 가족 관리자를
막았다 — 관리자가 기록은 통째로 지우면서 그 사진은 못 지우는 비대칭. 6곳이 갈라지면
어느 쪽이 옳은지 코드로 판별할 수 없으므로 술어 동일성을 고정한다.
"""
import inspect

import pytest

from app.application.handlers import client_app

GUARD = "if entry.author_person_id != person_id and membership.role != OWNER_ROLE:"

HANDLERS = [
    "update_app_record",
    "delete_app_record",
    "move_app_record",
    "create_app_record_media_upload_url",
    "complete_app_record_media",
    "delete_app_record_media",
]


@pytest.mark.parametrize("name", HANDLERS)
def test_edit_guard_is_identical(name):
    module = getattr(client_app, name, None) or __import__(
        f"app.application.handlers.client_app.{name}", fromlist=["_"]
    )
    assert GUARD in inspect.getsource(module), (
        f"{name}: 편집권 술어가 계단에서 벗어났다 (설계.md §15-6-4)"
    )
