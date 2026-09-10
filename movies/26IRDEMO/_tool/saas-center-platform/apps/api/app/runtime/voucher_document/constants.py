"""Voucher 추출 잡 상수.

stream/group(ai:jobs:batch / batch-workers)은 voucher 전용이 아니라 범용 batch
worker 인프라(app.infrastructure.worker.common.streams)에 정의된다. 여기엔 voucher 고유의
job_type 만 둔다.
"""

# job_type — JobMessage.job_type / JOB_HANDLERS 키. batch worker 가 이 type 으로 실행
JOB_TYPE_VOUCHER_EXTRACT = "voucher_extract"
