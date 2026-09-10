from dataclasses import dataclass

from pydantic import BaseModel, Field


class RolePermissionAssign(BaseModel):
    permission_ids: list[int] = Field(..., description="권한 ID 목록")

    model_config = {
        "json_schema_extra": {"examples": [{"permission_ids": [1, 2, 10, 11, 20, 21]}]}
    }


class RolePermissionsResponse(BaseModel):
    role_id: str
    role_code: str
    role_name: str
    access_level: str
    permissions: list[dict]  # [{id, code, name, category}, ...]

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "role_id": "550e8400-e29b-41d4-a716-446655440000",
                    "role_code": "counselor",
                    "role_name": "상담사",
                    "permissions": [
                        {"id": 1, "code": "read:client", "name": "내담자 조회", "category": "client"},
                        {"id": 2, "code": "write:client", "name": "내담자 생성/수정", "category": "client"},
                    ],
                }
            ]
        }
    }


@dataclass
class AssignRolePermissionsCommand:
    permission_ids: list[int]
