from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str


class DetailResponse(BaseModel):
    detail: str


class OkResponse(BaseModel):
    ok: bool = True


class StatusMessageResponse(BaseModel):
    status: str
    message: str
