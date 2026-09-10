from app.infrastructure.stt.common.base import STTProvider
from app.infrastructure.stt.aws.session import AWSTranscribeSession


class AWSTranscribeStreamingClient(STTProvider):
    def __init__(self, *, region: str, access_key: str, secret_key: str):
        self._region = region
        self._access_key = access_key
        self._secret_key = secret_key

    async def create_session(
        self, language_code: str = "ko-KR", sample_rate: int = 16000
    ) -> AWSTranscribeSession:
        return AWSTranscribeSession(
            region=self._region,
            access_key=self._access_key,
            secret_key=self._secret_key,
            language_code=language_code,
            sample_rate=sample_rate,
        )
