from pydantic import BaseModel, Field, model_validator
from .schemas import ClientResponse


class ExcelClientRowInput(BaseModel):
    name: str = Field(..., description="내담자 이름")
    birth_date: str = Field(..., description="생년월일 (YYYY-MM-DD)")
    gender: str = Field(..., description="성별 (male/female)")
    guardian_name: str | None = Field(None, description="보호자 이름")
    guardian_relationship: str | None = Field(None, description="관계 (엄마/아빠 등)")
    guardian_gender: str | None = Field(None, description="보호자 성별 (male/female)")
    guardian_birth_date: str | None = Field(None, description="보호자 생년월일 (YYYY-MM-DD)")
    guardian_phone: str | None = Field(None, description="보호자 연락처 (보호자 입력 시 필수)")

    @model_validator(mode="after")
    def validate_guardian_phone(self) -> "ExcelClientRowInput":
        if self.guardian_name and not self.guardian_phone:
            raise ValueError("보호자를 등록하려면 보호자 연락처가 필요합니다")
        return self


class ImportClientsFromExcelRequest(BaseModel):
    clients: list[ExcelClientRowInput] = Field(..., min_length=1)


class ExcelClientResult(BaseModel):
    index: int = Field(..., description="요청 배열 인덱스")
    client: ClientResponse = Field(..., description="등록된 내담자 (중복 시 기존 내담자)")
    skipped: bool = Field(False, description="중복으로 인해 신규 등록 생략 여부")


class ImportClientsFromExcelResponse(BaseModel):
    results: list[ExcelClientResult] = Field(..., description="등록 결과 (요청 순서 보장)")
    total: int = Field(..., description="총 등록 수")
