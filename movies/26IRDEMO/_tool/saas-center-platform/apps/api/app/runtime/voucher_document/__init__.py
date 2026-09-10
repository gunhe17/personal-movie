"""Voucher Document Runtime — 변환 3모듈 + 잡 오케스트레이션.

    document ─[document_to_markdown]→ MD ─[markdown_to_voucher]→ vouchers/meta
             └─[document_to_form]→ forms

공개 진입점: `extract_job.advance_batch_stage.advance_batch_stage_if_ready`
(단일 파이프라인 상태 머신 — query-trigger/cron이 조회당 한 단계씩 전진시킨다).

변환 모듈은 실행하지 않는다 — unit 빌드(build_*)와 결과 조립(assemble/parse_*/apply_*)만
제공하고, 실행(batch 제출·폴링/실시간 병렬)은 `batch_unit.run_stage`가 소유한다.
"""
