import json
import time
from app.core.datetime_utils import utc_now

from app.infrastructure.llm.common.cost import estimate_stt_cost
from app.core.logger import get_logger
from app.infrastructure.stt.aws.batch import batch_transcribe_segments
from ..models import LabExperimentRun
from ..prompts import TEXT_DIARIZE_SYSTEM_PROMPT
from ..repository import LabExperimentRunRepository

logger = get_logger(__name__)

# diarized_json을 지원하는 전용 모델
_DIARIZE_NATIVE_MODELS = {"gpt-4o-transcribe-diarize"}

# AWS Transcribe 스트리밍 모델
_AWS_TRANSCRIBE_MODELS = {"aws-transcribe-streaming"}


class RunSTTExperimentService:
    def __init__(
        self,
        repo: LabExperimentRunRepository,
        ai,
    ) -> None:
        self.repo = repo
        self.ai = ai

    async def execute(
        self,
        *,
        experiment_type: str = "stt_diarize",
        field_note_id: str | None = None,
        field_note_audio_id: str | None = None,
        sample_id: str | None = None,
        group_id: str | None = None,
        model_name: str,
        provider: str = "openai",
        model_params: dict | None = None,
        author_id: str | None = None,
        audio_bytes: bytes,
        audio_duration: float,
        audio_filename: str = "audio.webm",
        system_prompt: str | None = None,  # stt_text_diarize 전용: 화자 추론 프롬프트(없으면 기본값)
        tags: str | None = None,
        memo: str | None = None,
    ) -> LabExperimentRun:
        # STT 실험 실행.
        #
        # experiment_type:
        # - stt_transcribe: 단순 전사 (운영환경 5분 청크와 동일)
        # - stt_diarize: 화자분리 전사 (gpt-4o-transcribe-diarize 또는 specialized)
        now = utc_now()

        # 텍스트 화자분리: 사용한 프롬프트를 model_params 에 보존 → 추후 AI 개선 제안에 활용
        if experiment_type in ("stt_text_diarize", "stt_aws_text_diarize"):
            model_params = {
                **(model_params or {}),
                "system_prompt": system_prompt or TEXT_DIARIZE_SYSTEM_PROMPT,
            }

        run = await self.repo.add(
            experiment_type=experiment_type,
            field_note_id=field_note_id,
            field_note_audio_id=field_note_audio_id,
            sample_id=sample_id,
            group_id=group_id,
            provider=provider,
            model_name=model_name,
            model_params=json.dumps(model_params) if model_params else None,
            author_id=author_id,
            status="running",
            started_at=now,
            input_audio_duration=audio_duration,
            tags=tags,
            memo=memo,
        )

        try:
            t0 = time.monotonic()

            if model_name in _AWS_TRANSCRIBE_MODELS:
                result = await self._run_aws_transcribe(audio_bytes, audio_filename)
            elif experiment_type == "stt_text_diarize":
                # 텍스트 전용 화자분리: whisper-1 평문 전사 → LLM(model_name)이 화자 할당.
                # 음향(stt_diarize)과 동형 출력으로 lab A/B 비교가 가능하다.
                result = await self._run_text_diarize(
                    audio_bytes, model_name, audio_filename, provider, system_prompt,
                )
            elif experiment_type == "stt_aws_text_diarize":
                # AWS 실시간 전사(타임스탬프) → LLM(model_name)이 화자 라벨만 부여.
                # 프로덕션의 '실시간 전사 재사용 + 텍스트 화자분리' 경로를 검증한다.
                result = await self._run_aws_text_diarize(
                    audio_bytes, model_name, audio_filename, provider, system_prompt,
                )
            else:
                ai = self.ai

                if experiment_type == "stt_transcribe":
                    text = await ai.experiment_transcribe(
                        audio_bytes,
                        model=model_name,
                        language="ko",
                        filename=audio_filename,
                    )
                    result = {"text": text}
                elif model_name in _DIARIZE_NATIVE_MODELS:
                    result = await self._run_integrated(ai, audio_bytes, model_name, audio_filename, audio_duration)
                else:
                    result = await self._run_specialized(ai, audio_bytes, model_name, audio_filename)

            elapsed_ms = int((time.monotonic() - t0) * 1000)

            run.latency_ms = elapsed_ms
            run.output_json = json.dumps(result, ensure_ascii=False) if isinstance(result, dict) else None
            run.output_text = result.get("text", "") if isinstance(result, dict) else str(result)
            # 텍스트 분리는 전사 STT 비용만 집계 — model_name은 LLM이라 STT 단가표에 없음.
            # (LLM 토큰 비용은 별도이며 여기 집계에 포함되지 않는다)
            if experiment_type == "stt_aws_text_diarize":
                cost_model = "aws-transcribe-streaming"
            elif experiment_type == "stt_text_diarize":
                cost_model = "whisper-1"
            else:
                cost_model = model_name
            run.estimated_cost_usd = estimate_stt_cost(cost_model, audio_duration)
            run.status = "completed"
            run.completed_at = utc_now()

        except Exception as e:
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = utc_now()
            logger.error(f"STT experiment failed: {e}", exc_info=True)

        return run

    async def _aws_segments(
        self, audio_bytes: bytes, filename: str,
    ) -> list[dict]:
        # transport는 infra 소유 — 배치 전사 구현은 infrastructure/stt/aws/batch.py
        return await batch_transcribe_segments(audio_bytes, filename)

    async def _run_aws_transcribe(
        self, audio_bytes: bytes, filename: str,
    ) -> dict:
        # AWS Transcribe 배치 테스트: 타임스탬프 세그먼트 포함 결과.
        segments = await self._aws_segments(audio_bytes, filename)
        text = " ".join(s["text"] for s in segments if s["text"])
        logger.info(
            f"AWS Transcribe experiment done: {len(segments)} final segments, "
            f"{len(text)} chars"
        )
        return {"text": text, "segments": segments, "provider": "aws_transcribe"}

    async def _run_integrated(
        self, ai, audio_bytes: bytes,
        model_name: str, filename: str, audio_duration: float = 0,
    ) -> dict:
        # 통합 전략: gpt-4o-transcribe-diarize + diarized_json.
        return await ai.experiment_transcribe_with_diarization(
            audio_bytes,
            model=model_name,
            language="ko",
            model_override=model_name,
            filename=filename,
            known_duration=audio_duration,
        )

    async def _run_specialized(
        self, ai, audio_bytes: bytes,
        model_name: str, filename: str,
    ) -> dict:
        # 분리 전략: Whisper 전사(verbose_json) → pyannote 화자분리 → 정렬.
        from app.infrastructure.stt.factory import get_diarization_client
        from app.infrastructure.stt.pyannote.client import align_transcript_with_speakers
        from app.infrastructure.stt.common.schemas import TranscriptSegment

        # Step 1: Whisper 전사 (타임스탬프 포함)
        stt_result = await ai.experiment_transcribe_with_timestamps(
            audio_bytes,
            model=model_name,
            language="ko",
            model_override=model_name,
            filename=filename,
        )

        transcript_segments = [
            TranscriptSegment(text=s["text"], start=s["start"], end=s["end"])
            for s in stt_result.get("segments", [])
        ]

        # Step 2: pyannote 화자분리
        diarize_client = get_diarization_client()
        if not diarize_client:
            logger.warning(
                "pyannote 화자분리 불가 (HUGGINGFACE_TOKEN 미설정), "
                "화자를 모두 'A'로 할당합니다."
            )
            segments = [
                {"speaker": "A", "text": s.text, "start": s.start, "end": s.end}
                for s in transcript_segments
            ]
            text = " ".join(s["text"] for s in segments)
            return {"text": text, "segments": segments}

        speaker_segments = await diarize_client.diarize(audio_bytes)

        # Step 3: 타임스탬프 기반 정렬
        aligned = align_transcript_with_speakers(transcript_segments, speaker_segments)

        text = " ".join(s["text"] for s in aligned)
        logger.info(
            f"Specialized STT experiment done: {len(aligned)} segments, "
            f"{len(set(s['speaker'] for s in aligned))} speakers"
        )
        return {"text": text, "segments": aligned}

    async def _run_text_diarize(
        self, audio_bytes: bytes, llm_model: str, filename: str,
        provider: str = "openai", system_prompt: str | None = None,
    ) -> dict:
        # 텍스트 전용 화자분리: whisper-1 평문 전사 → LLM이 세그먼트별 화자 추론.
        #
        # 오디오 화자분리(specialized/integrated)와 달리 음향을 보지 않고, 전사 텍스트의
        # 내용·역할·턴테이킹 단서만으로 화자를 추론한다. 타임스탬프는 whisper 전사가
        # 제공하므로 음향분리와 동일하게 오디오 싱크가 유지된다(LLM은 라벨만 부여).
        # Step 1: whisper-1 전사 (세그먼트 타임스탬프 — llm_model과 무관하게 고정)
        stt_result = await self.ai.experiment_transcribe_with_timestamps(
            audio_bytes,
            model="whisper-1",
            language="ko",
            filename=filename,
        )
        segments = stt_result.get("segments", []) or []
        if not segments:
            return {"text": stt_result.get("text", ""), "segments": []}

        # Step 2: 전사 세그먼트 → LLM 화자 라벨
        return await self._label_segments(segments, llm_model, provider, system_prompt)

    async def _run_aws_text_diarize(
        self, audio_bytes: bytes, llm_model: str, filename: str,
        provider: str = "openai", system_prompt: str | None = None,
    ) -> dict:
        # AWS 실시간 전사 재사용 화자분리: AWS Transcribe 전사(타임스탬프) → LLM 화자 라벨.
        #
        # 프로덕션의 '실시간 전사 그대로 쓰고 LLM으로 화자만 분리' 경로를 검증한다.
        # gpt-4o-transcribe-diarize(음향 재전사)와 달리 전사 텍스트를 새로 만들지 않으므로
        # 사용자가 녹음 중 본 자막과 최종 본문이 일치한다. 타임스탬프는 AWS가 제공하므로
        # 오디오 싱크가 유지된다(LLM은 라벨만 부여).
        # Step 1: AWS Transcribe 전사 (final 세그먼트 + 타임스탬프)
        segments = await self._aws_segments(audio_bytes, filename)
        if not segments:
            return {"text": "", "segments": []}

        # Step 2: 전사 세그먼트 → LLM 화자 라벨
        return await self._label_segments(segments, llm_model, provider, system_prompt)

    async def _label_segments(
        self, segments: list[dict], llm_model: str,
        provider: str, system_prompt: str | None,
    ) -> dict:
        # 전사 세그먼트(text+타임스탬프) → LLM이 화자 라벨만 부여.
        #
        # 텍스트·순서·타임스탬프는 그대로 보존하고 speaker 라벨만 추가한다.
        # whisper/AWS 등 전사 소스와 무관하게 동일하게 동작한다.
        if not segments:
            return {"text": "", "segments": []}

        # 번호 매긴 발화 목록 → LLM 화자 할당
        numbered = "\n".join(
            f"[{i + 1}] {(s.get('text') or '').strip()}"
            for i, s in enumerate(segments)
        )
        result = await self.ai.run_experiment(
            provider=provider,
            model=llm_model,
            system_prompt=system_prompt or TEXT_DIARIZE_SYSTEM_PROMPT,
            user_prompt=numbered,
            max_tokens=4096,
        )
        raw = result.content

        # {번호: 화자} 파싱 → 세그먼트에 화자 부착 (텍스트·순서·타임스탬프 보존)
        speaker_by_idx = self._parse_speaker_assignment(raw, len(segments))
        out_segments = [
            {
                "speaker": speaker_by_idx.get(i, "A"),
                "text": s.get("text", ""),
                "start": s.get("start", 0.0),
                "end": s.get("end", 0.0),
            }
            for i, s in enumerate(segments)
        ]
        text = " ".join(
            s["text"].strip() for s in out_segments if s.get("text", "").strip()
        )
        n_speakers = len({s["speaker"] for s in out_segments})
        logger.info(
            f"Text-diarize labeling done: {len(out_segments)} segments, "
            f"{n_speakers} speakers (llm={llm_model})"
        )
        return {"text": text, "segments": out_segments}

    @staticmethod
    def _parse_speaker_assignment(raw: str, n_segments: int) -> dict[int, str]:
        # LLM 응답에서 {번호(0-based): 화자라벨} 추출. 파싱 실패분은 호출부에서 'A' 폴백.
        #
        # 기대 입력: {"1": "A", "2": "B", ...} (코드펜스/잡음 허용 — 첫 { ~ 마지막 } 추출)
        if not raw:
            return {}
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0 or end <= start:
            return {}
        try:
            parsed = json.loads(raw[start:end + 1])
        except (json.JSONDecodeError, TypeError):
            return {}
        if not isinstance(parsed, dict):
            return {}

        result: dict[int, str] = {}
        for key, val in parsed.items():
            try:
                idx = int(str(key).strip()) - 1  # 1-based → 0-based
            except (ValueError, TypeError):
                continue
            if not (0 <= idx < n_segments):
                continue
            label = str(val).strip().upper()[:1]  # 'A'/'B'/'C'… 첫 글자만
            if label.isalpha():
                result[idx] = label
        return result

    async def run_text_diarize_eval(
        self,
        *,
        segments: list[dict],
        model_name: str,
        provider: str = "openai",
        system_prompt: str | None = None,
        input_segments: list[dict] | None = None,
        merge_gap: float = 0.0,
    ) -> dict:
        # 정답 기반 텍스트 화자분리 평가 — 오디오/전사 없이 프롬프트 품질만 측정.
        #
        # 정답(클로바 등, 화자 라벨 포함)을 기준으로:
        # - input_segments(원본, 화자분리 안 된 실제 전사)가 주어지면 → 그걸 LLM 에 돌려
        # 화자를 배정하고, 정답과 **시간 기반**으로 비교(세그먼트 경계가 달라도 OK).
        # 프로덕션 실제 입력(STT 전사)에 가장 가까운 테스트.
        # - 없으면 → 정답에서 화자만 떼어 입력으로 사용(세그먼트 동일 = 이상적 입력).
        ref = [s for s in (segments or []) if (s.get("text") or "").strip()]
        if not ref:
            return {
                "labeled": [], "reference": [], "accuracy_pct": 0.0,
                "correct": 0, "total": 0, "label_mapping": {},
                "ref_speaker_count": 0, "pred_speaker_count": 0,
                "majority_baseline_pct": 0.0, "balanced_accuracy_pct": 0.0,
                "per_speaker_recall": {}, "latency_ms": 0, "per_segment": [],
                "input_count": 0, "merged_count": 0,
            }

        raw_input = [s for s in (input_segments or []) if (s.get("text") or "").strip()]
        if raw_input:
            return await self._eval_against_reference(
                ref, raw_input, model_name, provider, system_prompt, merge_gap,
            )

        # 폴백: 정답에서 화자만 떼어 입력으로 (세그먼트 동일 → 세그먼트 단위 정확도)
        ref_speakers = [str(s.get("speaker") or "?") for s in ref]
        stripped = [
            {"text": s.get("text", ""), "start": s.get("start", 0.0), "end": s.get("end", 0.0)}
            for s in ref
        ]
        t0 = time.monotonic()
        result = await self._label_segments(stripped, model_name, provider, system_prompt)
        latency_ms = int((time.monotonic() - t0) * 1000)
        pred_speakers = [str(s.get("speaker") or "?") for s in result.get("segments", [])]

        acc = self._segment_label_accuracy(ref_speakers, pred_speakers)
        per_segment = [
            {
                "idx": i,
                "text": ref[i].get("text", ""),
                "start": ref[i].get("start", 0.0),
                "ref_speaker": ref_speakers[i],
                "pred_speaker": pred_speakers[i] if i < len(pred_speakers) else "?",
                "mapped_pred": acc["label_mapping"].get(
                    pred_speakers[i] if i < len(pred_speakers) else "?",
                    pred_speakers[i] if i < len(pred_speakers) else "?",
                ),
                "correct": acc["correct_flags"][i],
            }
            for i in range(len(ref))
        ]
        logger.info(
            f"Text-diarize eval (ideal): {acc['correct']}/{acc['total']} "
            f"({acc['accuracy_pct']}%), model={model_name}"
        )
        return {
            "labeled": result.get("segments", []),
            "reference": ref,
            "accuracy_pct": acc["accuracy_pct"],
            "correct": acc["correct"],
            "total": acc["total"],
            "label_mapping": acc["label_mapping"],
            "ref_speaker_count": len(set(ref_speakers)),
            "pred_speaker_count": len(set(pred_speakers)),
            "majority_baseline_pct": acc["majority_baseline_pct"],
            "balanced_accuracy_pct": acc["balanced_accuracy_pct"],
            "per_speaker_recall": acc["per_speaker_recall"],
            "latency_ms": latency_ms,
            "per_segment": per_segment,
            "input_count": len(ref),
            "merged_count": len(ref),
        }

    async def _eval_against_reference(
        self, ref: list[dict], raw_input: list[dict],
        model_name: str, provider: str, system_prompt: str | None,
        merge_gap: float = 0.0,
    ) -> dict:
        # 원본(화자분리 안 된 전사)을 LLM 으로 화자분리 → 정답과 시간 기반 비교.
        #
        # merge_gap > 0 이면 LLM 라벨링 전에 침묵 간격으로 파편을 턴 단위로 병합한다
        # (AWS 실시간 전사의 과도한 파편화를 줄여 화자분리 정확도를 올리는 핵심 레버).
        from .calculate_diarization_accuracy import calculate_accuracy
        from app.infrastructure.stt.common.transcript import merge_segments_by_gap

        input_count = len(raw_input)
        # 침묵 간격 병합 (727 파편 → ~턴 단위)
        merged_input = merge_segments_by_gap(raw_input, merge_gap)

        # 원본 LLM 화자분리
        stripped = [
            {"text": s.get("text", ""), "start": float(s.get("start", 0.0) or 0.0),
             "end": float(s.get("end", 0.0) or 0.0)}
            for s in merged_input
        ]
        t0 = time.monotonic()
        result = await self._label_segments(stripped, model_name, provider, system_prompt)
        latency_ms = int((time.monotonic() - t0) * 1000)
        cand = self._fill_ends(result.get("segments", []))
        ref_e = self._fill_ends(ref)

        duration = max(
            (s["end"] for s in cand + ref_e if s.get("end")),
            default=0.0,
        )
        acc = calculate_accuracy(ref_e, cand, duration)
        seg_correct = acc.get("segment_correct", [])
        mapping = acc.get("label_mapping", {})

        per_segment = []
        for i, s in enumerate(cand):
            pred = str(s.get("speaker") or "?")
            mid = (s["start"] + s["end"]) / 2
            per_segment.append({
                "idx": i,
                "text": s.get("text", ""),
                "start": s.get("start", 0.0),
                "ref_speaker": self._speaker_at(ref_e, mid),  # 그 시점 정답 화자
                "pred_speaker": pred,
                "mapped_pred": mapping.get(pred, pred),
                "correct": seg_correct[i] if i < len(seg_correct) else False,
            })
        correct = sum(1 for p in per_segment if p["correct"])
        logger.info(
            f"Text-diarize eval (raw input): acc={acc.get('accuracy_pct', 0)}%, "
            f"merge {input_count}→{len(merged_input)} segs, model={model_name}"
        )
        return {
            "labeled": cand,
            "reference": ref_e,
            "accuracy_pct": acc.get("accuracy_pct", 0.0),
            "correct": correct,
            "total": len(cand),
            "label_mapping": mapping,
            "ref_speaker_count": len({str(s.get("speaker") or "?") for s in ref}),
            "pred_speaker_count": len({str(s.get("speaker") or "?") for s in cand}),
            "majority_baseline_pct": acc.get("majority_baseline_pct", 0.0),
            "balanced_accuracy_pct": acc.get("balanced_accuracy_pct", 0.0),
            "per_speaker_recall": acc.get("per_speaker_recall", {}),
            "latency_ms": latency_ms,
            "per_segment": per_segment,
            "input_count": input_count,
            "merged_count": len(merged_input),
        }

    @staticmethod
    def _fill_ends(segs: list[dict]) -> list[dict]:
        # 세그먼트 end 가 없으면 다음 세그먼트 start 로 채움(마지막은 +5s).
        out = []
        for i, s in enumerate(segs):
            start = float(s.get("start", 0.0) or 0.0)
            end = float(s.get("end", 0.0) or 0.0)
            if end <= start:
                end = float(segs[i + 1].get("start", start)) if i + 1 < len(segs) else start + 5.0
            out.append({**s, "start": start, "end": end})
        return out

    @staticmethod
    def _speaker_at(segs: list[dict], t: float) -> str:
        for s in segs:
            if s["start"] <= t < s["end"]:
                return str(s.get("speaker") or "?")
        return "?"

    @staticmethod
    def _segment_label_accuracy(ref: list[str], pred: list[str]) -> dict:
        # 예측 화자 라벨을 정답 라벨에 최적 매핑(permutation)해 세그먼트 정확도 계산.
        #
        # 화자분리는 라벨 이름 자체(A/B vs 참석자1/2)가 달라도 '같은 사람을 같은 라벨로
        # 묶었는가'가 핵심이므로, pred 라벨 → ref 라벨의 최적 1:1 매핑으로 일치율을 잰다.
        from itertools import permutations

        n = min(len(ref), len(pred))
        ref, pred = ref[:n], pred[:n]
        empty = {
            "accuracy_pct": 0.0, "correct": 0, "total": 0, "label_mapping": {},
            "correct_flags": [], "majority_baseline_pct": 0.0,
            "balanced_accuracy_pct": 0.0, "per_speaker_recall": {},
        }
        if n == 0:
            return empty

        ref_labels = list(dict.fromkeys(ref))
        pred_labels = list(dict.fromkeys(pred))

        # 화자 수가 과도하면 permutation 폭발 방지 — identity 매핑으로 폴백
        if len(pred_labels) > 6 or len(ref_labels) > 6:
            mapping = {p: p for p in pred_labels}
        else:
            best_correct, mapping = -1, {}
            for perm in permutations(ref_labels, min(len(pred_labels), len(ref_labels))):
                m = dict(zip(pred_labels, perm))
                c = sum(1 for r, p in zip(ref, pred) if m.get(p) == r)
                if c > best_correct:
                    best_correct, mapping = c, m

        correct_flags = [mapping.get(p) == r for r, p in zip(ref, pred)]
        correct = sum(correct_flags)

        # 임밸런스 보정 — '높을 수밖에 없는' 점수를 분리해 본다(다수 화자 baseline·화자별 recall·균형).
        ref_counts: dict[str, int] = {}
        for r in ref:
            ref_counts[r] = ref_counts.get(r, 0) + 1
        majority = round(max(ref_counts.values()) / n * 100, 1) if ref_counts else 0.0
        recall: dict[str, float] = {}
        for s, tot in ref_counts.items():
            hit = sum(1 for r, p in zip(ref, pred) if r == s and mapping.get(p) == r)
            recall[s] = round(hit / tot * 100, 1)
        balanced = round(sum(recall.values()) / len(recall), 1) if recall else 0.0

        return {
            "accuracy_pct": round(correct / n * 100, 1),
            "correct": correct,
            "total": n,
            "label_mapping": mapping,
            "correct_flags": correct_flags,
            "majority_baseline_pct": majority,
            "balanced_accuracy_pct": balanced,
            "per_speaker_recall": recall,
        }
