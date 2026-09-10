import re

from app.core.exceptions import InvalidOperationException


class RenderTemplateService:
    @staticmethod
    def execute(content: str, variables: dict[str, str]) -> str:
        # 값이 없는 변수가 포함된 줄을 통째로 제거
        empty_keys = {
            key for key in re.findall(r"\{(\w+)\}", content)
            if key not in variables or not variables[key]
        }

        if empty_keys:
            lines = content.split("\n")
            filtered = []
            for line in lines:
                line_vars = set(re.findall(r"\{(\w+)\}", line))
                if line_vars and line_vars.issubset(empty_keys):
                    continue
                filtered.append(line)
            content = "\n".join(filtered)

        def replacer(match: re.Match) -> str:
            key = match.group(1)
            return variables.get(key, "")

        return re.sub(r"\{(\w+)\}", replacer, content)

