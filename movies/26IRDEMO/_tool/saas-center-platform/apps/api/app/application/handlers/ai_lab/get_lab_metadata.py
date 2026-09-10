# 실험 유형 기본 시스템 프롬프트는 field_note 프로덕션 프롬프트를 단일 소스로 쓴다 (크로스 모듈).
from app.modules.ai_lab import build_lab_metadata, LabMetadataResponse
from app.runtime.field_note.prompts import get_production_prompts


def get_lab_metadata_handler() -> LabMetadataResponse:
    fn_prompts = get_production_prompts()
    return build_lab_metadata(fn_prompts)


TOOL = {
    "name": "get_lab_metadata_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "AI Lab 실험 화면을 구성하기 위한 메타데이터(실험 유형, 유형별 기본 시스템 프롬프트, 선택지)를 조회한다.",
    "keywords": ['get lab metadata', "랩 메타데이터", "실험 유형 목록", "실험 옵션", "기본 프롬프트", "실험 설정값", "AI Lab 정보", "실험 종류", "프롬프트 기본값"],
    "boundaries": "운영자(어드민) 전용 읽기 도구로, AI Lab 실험을 시작할 때 필요한 '선택지/기본값 세트'를 준다 (실험 유형과 각 유형의 기본 시스템 프롬프트는 field_note 프로덕션 프롬프트를 단일 소스로 가져온다). 실제 비용 집계는 get_cost_summary_handler를, 프로덕션 프롬프트를 실험 버전으로 가져오는 작업은 import_production_prompts_handler를 쓴다. 이 도구는 메타데이터 조회 전용이며 아무 것도 변경하지 않는다.",
    "output": "실험 유형·유형별 기본 프롬프트·선택지 메타데이터 (LabMetadataResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
        },
        "required": [],
    },
}
