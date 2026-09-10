import json

from app.core.exceptions import InvalidOperationException

from ..prompts import TEXT_DIARIZE_SYSTEM_PROMPT
from .calculate_diarization_accuracy import (
    calculate_accuracy,
    dominant_speaker_at,
    segments_from_output_json,
)

_CRITIC_SYSTEM_PROMPT = (
    "당신은 한국어 화자분리(speaker diarization) 프롬프트를 개선하는 프롬프트 엔지니어입니다. "
    "현재 프롬프트와, 그 프롬프트로 화자를 '틀리게' 배정한 사례들이 주어집니다. "
    "사례를 분석해 프롬프트의 어떤 지시가 부족/모호해서 틀렸는지 진단하고, "
    "정확도를 높일 구체적인 수정안을 제시하세요.\n"
    "규칙:\n"
    "- 전체를 다시 쓰지 말고, '추가/수정할 문장'과 '그 이유'를 핀포인트로.\n"
    "- 상담사/내담자 또는 다중 화자 구분 단서(어조·역할·턴테이킹)를 강화하는 방향.\n"
    "- 한국어로, 3~5개 항목의 실행 가능한 제안. 마지막에 한 줄 요약.\n"
    "- 코드펜스 없이 평문으로."
)

_MISMATCH_LIMIT = 18  # 토큰 절약 — 틀린 사례 최대 개수


def _build_mismatch_examples(
    reference: list[dict],
    candidate: list[dict],
    accuracy: dict,
) -> list[dict]:
    seg_correct = accuracy.get("segment_correct", [])
    mapping = accuracy.get("label_mapping", {})  # cand→ref
    examples: list[dict] = []
    for i, seg in enumerate(candidate):
        if i < len(seg_correct) and seg_correct[i] is False:
            ref_sp = dominant_speaker_at(reference, float(seg.get("start", 0)), float(seg.get("end", 0)))
            examples.append({
                "text": (seg.get("text") or "").strip(),
                "predicted": mapping.get(seg.get("speaker"), seg.get("speaker")),
                "correct": ref_sp,
            })
        if len(examples) >= _MISMATCH_LIMIT:
            break
    return examples


class GeneratePromptSuggestionService:
    # repo 없음 — 입력은 로드된 run/sample(service.md §5), LLM은 주입 AIFacade
    def __init__(
        self,
        ai,
    ) -> None:
        self._ai = ai

    async def execute(
        self,
        run,
        sample,
        *,
        model: str = "gpt-4o",
    ) -> dict:
        # verify
        if run.experiment_type != "stt_text_diarize":
            raise InvalidOperationException("텍스트 화자분리 실험만 프롬프트 개선 제안이 가능합니다.")
        if not run.sample_id:
            raise InvalidOperationException("샘플 기반 실험만 분석할 수 있습니다.")
        if not sample or not sample.reference_segments:
            raise InvalidOperationException("이 샘플에 정답(reference)이 없습니다. 먼저 정답을 만들어주세요.")

        # compute
        try:
            params = json.loads(run.model_params) if run.model_params else {}
        except (json.JSONDecodeError, TypeError):
            params = {}
        current_prompt = params.get("system_prompt") or TEXT_DIARIZE_SYSTEM_PROMPT

        reference = json.loads(sample.reference_segments)
        candidate = segments_from_output_json(run.output_json)
        accuracy = calculate_accuracy(reference, candidate, sample.audio_duration or 0.0)

        examples = _build_mismatch_examples(reference, candidate, accuracy)
        if not examples:
            return {
                "suggestion": "틀린 구간이 없습니다. 현재 프롬프트로 충분히 정확합니다.",
                "mismatch_count": 0,
                "accuracy_pct": accuracy.get("accuracy_pct", 0.0),
            }

        lines = [
            f"- \"{e['text'][:80]}\" → 모델은 화자 {e['predicted']}로 배정했으나 정답은 화자 {e['correct']}"
            for e in examples
        ]
        user_prompt = (
            f"[현재 프롬프트]\n{current_prompt}\n\n"
            f"[정확도] {accuracy.get('accuracy_pct')}% "
            f"(정답 화자 {accuracy.get('ref_speakers')}명 / 결과 화자 {accuracy.get('cand_speakers')}명)\n\n"
            f"[화자를 틀리게 배정한 사례 {len(examples)}건]\n" + "\n".join(lines) + "\n\n"
            "위 오류를 줄이려면 현재 프롬프트의 어떤 부분을 어떻게 고쳐야 할까요?"
        )

        # return
        result = await self._ai.run_experiment(
            provider="openai",
            model=model,
            system_prompt=_CRITIC_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=1024,
        )
        return {
            "suggestion": (result.content or "").strip(),
            "mismatch_count": len(examples),
            "accuracy_pct": accuracy.get("accuracy_pct", 0.0),
        }
