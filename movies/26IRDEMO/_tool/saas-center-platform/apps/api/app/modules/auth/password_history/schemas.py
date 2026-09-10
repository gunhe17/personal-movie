from pydantic import BaseModel, Field, ConfigDict


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="8-72자, 영문자+숫자 조합"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "current_password": "OldPass123!",
                "new_password": "NewSecurePass456!"
            }
        }
    )


class ChangePasswordResponse(BaseModel):
    message: str
    sessions_revoked: int  # 로그아웃된 세션 개수
