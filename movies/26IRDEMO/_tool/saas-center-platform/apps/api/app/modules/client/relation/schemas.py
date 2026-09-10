from datetime import datetime
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class RelationType(str, Enum):
    GUARDIAN = "guardian"  # 자녀 → 보호자
    CHILD = "child"        # 보호자 → 자녀


class GuardianRelationDetail(str, Enum):
    # 혈연 관계
    MOTHER = "mother"
    FATHER = "father"
    GRANDMOTHER = "grandmother"
    GRANDFATHER = "grandfather"
    AUNT = "aunt"
    UNCLE = "uncle"

    # 비혈연 보호자
    SOCIAL_WORKER = "social_worker"
    FOSTER_PARENT = "foster_parent"
    LEGAL_GUARDIAN = "legal_guardian"
    CAREGIVER = "caregiver"


class SiblingRelationDetail(str, Enum):
    OLDER_BROTHER = "older_brother"
    YOUNGER_BROTHER = "younger_brother"
    OLDER_SISTER = "older_sister"
    YOUNGER_SISTER = "younger_sister"
    SIBLING = "sibling"  # 성별/나이 불명


# guardian/sibling 개별 스키마 — HTTP 표면은 통합(RelationCreateRequest), 이들은 batch/excel 경로 내부 캐리어 + events payload

class ClientRelationCreate(BaseModel):
    client_id: str = Field(..., description="Client UUID")
    related_client_id: str = Field(..., description="관계 대상 Client UUID")
    relation_type: RelationType = Field(..., description="관계 유형")
    relation_detail: GuardianRelationDetail | None = Field(None, description="관계 상세 (guardian만)")
    is_primary: bool = Field(default=False, description="주 보호자 여부")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "client_id": "550e8400-e29b-41d4-a716-446655440001",
                    "related_client_id": "550e8400-e29b-41d4-a716-446655440002",
                    "relation_type": "guardian",
                    "relation_detail": "mother",
                    "is_primary": True
                },
                {
                    "client_id": "550e8400-e29b-41d4-a716-446655440001",
                    "related_client_id": "550e8400-e29b-41d4-a716-446655440003",
                    "relation_type": "guardian",
                    "relation_detail": "social_worker",
                    "is_primary": False
                }
            ]
        }
    }


class ClientRelationResponse(BaseModel):
    id: str
    center_id: str
    client_id: str
    related_client_id: str
    relation_type: str
    relation_detail: str | None
    is_primary: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SiblingRelationCreate(BaseModel):
    client_id: str = Field(..., description="Client UUID")
    sibling_id: str = Field(..., description="형제자매 Client UUID")
    relation_detail: SiblingRelationDetail | None = Field(None, description="관계 상세")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "client_id": "550e8400-e29b-41d4-a716-446655440001",
                    "sibling_id": "550e8400-e29b-41d4-a716-446655440004",
                    "relation_detail": "older_brother"
                },
                {
                    "client_id": "550e8400-e29b-41d4-a716-446655440001",
                    "sibling_id": "550e8400-e29b-41d4-a716-446655440005",
                    "relation_detail": "younger_sister"
                }
            ]
        }
    }


class SiblingRelationResponse(BaseModel):
    id: str
    center_id: str
    client_id: str
    sibling_id: str
    relation_detail: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# 통합 스키마 (Client-Centric API용)

class RelationCreateRequest(BaseModel):
    # 관계 생성 요청 (Client-Centric)
    #
    # relation_category로 guardian/sibling 구분
    relation_category: Literal["guardian", "sibling"] = Field(
        ...,
        description="관계 카테고리 (guardian: 보호자-자녀, sibling: 형제자매)"
    )
    related_client_id: str = Field(..., description="관계 대상 Client UUID")

    # Guardian 전용 필드
    relation_type: RelationType | None = Field(None, description="관계 유형 (guardian만: guardian/child)")
    relation_detail: GuardianRelationDetail | SiblingRelationDetail | None = Field(
        None,
        description="관계 상세"
    )
    is_primary: bool = Field(default=False, description="주 보호자 여부 (guardian만)")

    @field_validator("relation_type")
    @classmethod
    def validate_relation_type(cls, v, info):
        if info.data.get("relation_category") == "guardian" and v is None:
            raise ValueError("Guardian 관계에는 relation_type이 필수입니다")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "relation_category": "guardian",
                    "related_client_id": "550e8400-e29b-41d4-a716-446655440002",
                    "relation_type": "guardian",
                    "relation_detail": "mother",
                    "is_primary": True
                },
                {
                    "relation_category": "sibling",
                    "related_client_id": "550e8400-e29b-41d4-a716-446655440004",
                    "relation_detail": "older_brother"
                }
            ]
        }
    }


class RelationResponse(BaseModel):
    # 관계 응답 (Client-Centric, 통합)
    #
    # relation_category로 타입 구분
    id: str
    relation_category: Literal["guardian", "sibling"]
    center_id: str
    client_id: str
    related_client_id: str
    # 상대의 이름. 이걸 안 주면 호출부가 관계마다 단건 조회를 부르게 되는데,
    # 그 경로에는 담당 범위 가드(access_level=own)가 걸려 있어 보호자는 404가 난다.
    related_client_name: str | None = None

    # Guardian 전용 필드
    relation_type: str | None = None
    is_primary: bool | None = None

    # 공통 필드
    relation_detail: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
