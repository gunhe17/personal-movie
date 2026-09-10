from collections.abc import Mapping, Sequence


def format_tool_for_embedding(
    *,
    name: str,
    purpose: str,
    keywords: Sequence[str],
    boundaries: str,
    parameters: Mapping[str, str],
) -> str:
    keyword_text = ", ".join(keywords)
    params_text = "\n".join(f"- {param}: {desc}" for param, desc in parameters.items())
    return (
        f"[도구 이름]: {name}\n"
        f"[핵심 목적]: {purpose}\n"
        f"[관련 키워드]: {keyword_text}\n"
        f"[차별점/주의사항]: {boundaries}\n\n"
        f"[입력 파라미터]:\n{params_text}"
    )
