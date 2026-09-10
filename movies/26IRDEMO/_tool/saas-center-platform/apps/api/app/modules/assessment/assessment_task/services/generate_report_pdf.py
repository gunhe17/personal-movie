import hashlib
from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML
from pathlib import Path

from app.core.exceptions import InvalidOperationException
from app.infrastructure.storage import StorageClient
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class GenerateReportPdfService:
    # 검사 코드별 전용 템플릿 매핑 (없으면 DEFAULT_TEMPLATE 사용)
    TEMPLATE_MAP: dict[str, str] = {}
    DEFAULT_TEMPLATE = "assessment_report.html"

    def __init__(self, repo: AssessmentTaskRepository, storage: StorageClient):
        self.repo = repo
        self.storage = storage

    async def execute(
        self,
        task_id: str,
        assessment_info: dict,  # kor_name, code 등
        client_info: dict | None = None,  # student_name, birth_date, gender, school_name
    ) -> dict:
        # load
        task = await self.repo.get_by_id(task_id=task_id)

        # verify
        if not task.report_payload:
            raise InvalidOperationException("채점 결과가 없어 보고서를 생성할 수 없습니다")

        # compute
        html_content = self._render_html(task, assessment_info, client_info or {})

        pdf_bytes = self._convert_to_pdf(html_content)

        file_size = len(pdf_bytes)
        checksum = hashlib.sha256(pdf_bytes).hexdigest()

        # persist
        file_path = f"reports/{task.center_id}/{task_id}.pdf"
        await self.storage.upload_file(
            file_data=pdf_bytes,
            path=file_path,
            content_type="application/pdf",
        )

        return {
            "file_size": file_size,
            "checksum": checksum,
            "storage_path": file_path,
        }

    def _render_html(self, task: AssessmentTask, assessment_info: dict, client_info: dict) -> str:
        template_dir = Path(__file__).parent.parent / "templates"

        template_dir.mkdir(parents=True, exist_ok=True)

        env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml']),
            auto_reload=True,
            cache_size=0
        )

        template_name = self.TEMPLATE_MAP.get(
            assessment_info.get("code", ""), self.DEFAULT_TEMPLATE
        )
        template = env.get_template(template_name)

        payload = task.report_payload
        scoring = payload.get("scoring", {})
        interpretation = payload.get("interpretation", {})

        html = template.render(
            assessment_name=assessment_info["kor_name"],
            assessment_code=assessment_info["code"],

            student_name=client_info.get("student_name", ""),
            birth_date=client_info.get("birth_date", ""),
            gender=client_info.get("gender", ""),
            school_name=client_info.get("school_name", ""),

            task_id=task.id,
            completed_at=task.completed_at.strftime("%Y년 %m월 %d일 %H:%M") if task.completed_at else "",

            total_score=scoring.get("total_score", 0),
            max_total_score=scoring.get("max_total_score", 60),
            subscales=scoring.get("subscales", {}),

            risk_level=interpretation.get("risk_level", "low"),
            risk_label=interpretation.get("risk_label", "일반사용자군"),
            summary=interpretation.get("summary", ""),
            description=interpretation.get("description", ""),
            recommendations=interpretation.get("recommendations", []),
            subscale_interpretations=interpretation.get("subscales", {}),

            scored_at=payload.get("scored_at", ""),
            age_group=scoring.get("metadata", {}).get("age_group", ""),
        )

        return html

    def _convert_to_pdf(self, html_content: str) -> bytes:
        return HTML(string=html_content).write_pdf()
