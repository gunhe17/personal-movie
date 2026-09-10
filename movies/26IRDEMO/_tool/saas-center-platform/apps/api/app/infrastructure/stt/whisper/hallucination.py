import re

EN_HALLUCINATION_RE = re.compile(
    r"\b(?:thanks?\s+(?:for|you)|(?:please\s+)?subscribe|"
    r"i\s+don'?t\s+(?:know|think)|(?:oh\s+)?my\s+god|"
    r"(?:you\s+)?know\s+what|let'?s\s+go|good\s+(?:morning|evening|night|bye)|"
    r"see\s+you|bye\s+bye|what'?s\s+up|how\s+are\s+you|"
    r"so\s+(?:good|nice|much)|oh\s+(?:really|well|okay))\b",
    re.IGNORECASE,
)


def is_ko_hallucination(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    if re.search(r"[가-힣]", stripped):
        return False
    if re.fullmatch(r"[A-Za-z\s\d.,!?'\"-]+", stripped):
        return True
    return bool(EN_HALLUCINATION_RE.search(stripped))
