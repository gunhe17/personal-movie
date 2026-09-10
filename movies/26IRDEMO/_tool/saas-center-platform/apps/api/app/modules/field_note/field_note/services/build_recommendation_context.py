from app.core.exceptions import InvalidOperationException


class BuildRecommendationContextService:
    def execute(
        self,
        audios: list,
        entries: list,
        previous_summaries: list[str] | None = None,
    ) -> str:
        # compute
        transcripts = [
            a.transcript
            for a in sorted(audios, key=lambda a: a.chunk_index)
            if a.transcript and a.transcript_status == "completed"
        ]

        entry_texts = []
        for entry in sorted(entries, key=lambda e: e.timestamp_seconds):
            if entry.entry_type == "memo":
                entry_texts.append(f"[메모] {entry.content}")
            elif entry.entry_type == "tag":
                entry_texts.append(f"[태그:{entry.tag_category}] {entry.content}")

        context_parts = []
        if previous_summaries:
            context_parts.append("=== 이전 회기 요약 ===\n" + "\n\n".join(f"• {s}" for s in previous_summaries))
        if transcripts:
            context_parts.append("=== 현재 회기 전사 내용 ===\n" + "\n".join(transcripts))
        if entry_texts:
            context_parts.append("=== 상담사 메모 및 태그 ===\n" + "\n".join(entry_texts))

        # verify
        if not context_parts:
            raise InvalidOperationException(
                "아직 전사된 내용이 없습니다. 잠시 후 다시 시도해 주세요."
            )

        # return
        return "\n\n".join(context_parts)
