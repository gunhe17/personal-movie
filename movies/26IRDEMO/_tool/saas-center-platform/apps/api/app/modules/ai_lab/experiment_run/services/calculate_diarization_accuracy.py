# 화자분리 정확도 계산 — 정답(reference) 대비 후보(candidate) 일치율.
#
# 정답과 후보는 각각 화자 라벨이 임의(A/B/C…)이므로, 라벨 순열을 전수 탐색해
# 타임라인 일치가 최대가 되는 매핑을 찾아 정확도를 산출한다(0.5초 격자 기준).
# 세그먼트 분절이 서로 달라도 시각 기준으로 비교하므로 정렬 문제가 없다.
import itertools
import json


def _speaker_at(segments: list[dict], t: float) -> str | None:
    for s in segments:
        if float(s.get("start", 0.0)) <= t < float(s.get("end", 0.0)):
            return s.get("speaker")
    return None


def dominant_speaker_at(segments: list[dict], start: float, end: float, step: float = 0.5) -> str | None:
    # 구간 [start,end) 에서 가장 오래 발화한 화자(다수결).
    counts: dict[str, int] = {}
    t = start
    while t < end:
        sp = _speaker_at(segments, t)
        if sp is not None:
            counts[sp] = counts.get(sp, 0) + 1
        t += step
    return max(counts, key=counts.get) if counts else None


def calculate_accuracy(
    reference: list[dict],
    candidate: list[dict],
    duration: float,
    step: float = 0.5,
) -> dict:
    if not reference or not candidate or duration <= 0:
        return {
            "accuracy_pct": 0.0, "matched_ticks": 0, "total_ticks": 0,
            "ref_speakers": len({s.get("speaker") for s in (reference or [])}),
            "cand_speakers": len({s.get("speaker") for s in (candidate or [])}),
            "label_mapping": {}, "segment_correct": [], "confusion": [],
            "majority_baseline_pct": 0.0, "balanced_accuracy_pct": 0.0,
            "per_speaker_recall": {},
        }

    n_ticks = int(duration / step) + 1
    ticks = [i * step for i in range(n_ticks)]
    pairs = [(_speaker_at(reference, t), _speaker_at(candidate, t)) for t in ticks]
    eval_pairs = [(r, c) for r, c in pairs if r is not None and c is not None]

    ref_labels = sorted({r for r, _ in eval_pairs})
    cand_labels = sorted({c for _, c in eval_pairs})

    best_mapping: dict[str, str] = {}
    best_matched = 0
    if eval_pairs and ref_labels and cand_labels:
        # cand 라벨 → ref 라벨 매핑 전수 탐색 (라벨 수 적음)
        for perm in itertools.permutations(ref_labels, min(len(ref_labels), len(cand_labels))):
            mapping = dict(zip(cand_labels, perm))
            matched = sum(1 for r, c in eval_pairs if mapping.get(c) == r)
            if matched > best_matched:
                best_matched = matched
                best_mapping = mapping

    total = len(eval_pairs)
    accuracy = (best_matched / total * 100.0) if total else 0.0

    # 임밸런스 보정 지표 — 상담 녹취는 한 화자가 압도적이라 전체 정확도가 '높을 수밖에' 없다.
    #   majority_baseline: '전부 다수 화자'로 찍었을 때 점수(=다수 화자 발화 비율). 이걸 넘어야 실력.
    #   per_speaker_recall: 화자별로 그 화자 구간을 몇 % 맞췄나(소수 화자 recall = 진짜 신호).
    #   balanced_accuracy: 화자별 recall 평균(발화량 무관 동등 가중) → '전부 A' 트릭을 깸.
    ref_counts: dict[str, int] = {}
    for r, _ in eval_pairs:
        ref_counts[r] = ref_counts.get(r, 0) + 1
    majority_baseline = round(max(ref_counts.values()) / total * 100.0, 1) if (total and ref_counts) else 0.0
    per_speaker_recall: dict[str, float] = {}
    for s in ref_labels:
        tot_s = ref_counts.get(s, 0)
        if not tot_s:
            continue
        hit_s = sum(1 for r, c in eval_pairs if r == s and best_mapping.get(c) == r)
        per_speaker_recall[s] = round(hit_s / tot_s * 100.0, 1)
    balanced_accuracy = (
        round(sum(per_speaker_recall.values()) / len(per_speaker_recall), 1)
        if per_speaker_recall else 0.0
    )

    # 세그먼트별 정답 여부 + 혼동(어떤 화자를 무엇으로 틀렸나) 집계
    segment_correct: list[bool] = []
    confusion_counts: dict[tuple[str, str], int] = {}
    for seg in candidate:
        s0, s1 = float(seg.get("start", 0.0)), float(seg.get("end", 0.0))
        mapped = best_mapping.get(seg.get("speaker"))
        hit = tot = 0
        t = s0
        while t < s1:
            ref_sp = _speaker_at(reference, t)
            if ref_sp is not None:
                tot += 1
                if ref_sp == mapped:
                    hit += 1
            t += step
        ok = tot > 0 and hit / tot >= 0.5
        segment_correct.append(ok)
        if not ok:
            correct_ref = dominant_speaker_at(reference, s0, s1, step)
            if correct_ref:
                key = (str(mapped) if mapped else "?", correct_ref)
                confusion_counts[key] = confusion_counts.get(key, 0) + 1

    confusion = [
        {"predicted": p, "correct": c, "count": n}
        for (p, c), n in sorted(confusion_counts.items(), key=lambda x: -x[1])
    ][:5]

    return {
        "accuracy_pct": round(accuracy, 1),
        "matched_ticks": best_matched,
        "total_ticks": total,
        "ref_speakers": len(ref_labels),
        "cand_speakers": len(cand_labels),
        "label_mapping": best_mapping,
        "segment_correct": segment_correct,
        "confusion": confusion,
        "majority_baseline_pct": majority_baseline,
        "balanced_accuracy_pct": balanced_accuracy,
        "per_speaker_recall": per_speaker_recall,
    }


def segments_from_output_json(output_json: str | None) -> list[dict]:
    if not output_json:
        return []
    try:
        data = json.loads(output_json)
    except (json.JSONDecodeError, TypeError):
        return []
    segs = data.get("segments", []) if isinstance(data, dict) else data
    return segs if isinstance(segs, list) else []


class CalculateDiarizationAccuracyService:
    # pure-logic — 입력은 로드된 run/sample(service.md §5)
    def execute(self, run, sample) -> dict:
        import json

        from app.core.exceptions import InvalidOperationException

        # verify
        if not run.sample_id:
            raise InvalidOperationException("샘플 기반 실험만 정확도를 측정할 수 있습니다.")
        if not sample or not sample.reference_segments:
            raise InvalidOperationException("이 샘플에 정답(reference)이 없습니다. 먼저 정답을 만들어주세요.")

        # compute
        reference = json.loads(sample.reference_segments)
        candidate = segments_from_output_json(run.output_json)
        return calculate_accuracy(reference, candidate, sample.audio_duration or 0.0)
