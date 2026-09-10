from app.runtime.field_note.executor import (
    process_counseling_note,
    process_diarize,
    process_pipeline,
    process_refine,
    process_summary,
    process_transcribe,
    process_transcribe_chunk,
)
from app.runtime.ai_lab.executor import process_lab_batch_compare
from app.runtime.form_template.executor import process_form_extract
from app.runtime.case_analysis.executor import process_case_analysis
from app.runtime.voucher_document.executor import process_voucher_extract

# job_type → executor. @register 대체(참조=import). 새 잡은 여기 한 줄.
JOB_HANDLERS = {
    "form_extract": process_form_extract,
    "transcribe": process_transcribe,
    "transcribe_chunk": process_transcribe_chunk,
    "diarize": process_diarize,
    "refine": process_refine,
    "summary": process_summary,
    "counseling_note": process_counseling_note,
    "pipeline": process_pipeline,
    "lab_batch_compare": process_lab_batch_compare,
    "case_analysis": process_case_analysis,
    "voucher_extract": process_voucher_extract,
}
