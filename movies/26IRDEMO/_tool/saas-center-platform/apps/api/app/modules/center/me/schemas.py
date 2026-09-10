from pydantic import BaseModel


class MyPermissionsResponse(BaseModel):
    center_id: str
    member_id: str
    role_code: str
    permissions: list[str]
    permissions_version: int
    access_level: str

