import uuid


class DocumentPathProvider:
    """
    Document S3 경로 생성 규칙 관리

    경로 규칙을 한 곳에서 관리하여 변경에 강건하게 만듭니다.
    """

    @staticmethod
    def generate_temp_path(center_id: str, filename: str) -> tuple[str, uuid.UUID]:
        temp_uuid = uuid.uuid4()
        temp_path = f"centers/{center_id}/documents/temp/{temp_uuid}-{filename}"
        return temp_path, temp_uuid

    @staticmethod
    def generate_final_path(
        center_id: str, document_id: str, temp_uuid: uuid.UUID, filename: str
    ) -> str:
        return f"centers/{center_id}/documents/{document_id}/{temp_uuid}-{filename}"
