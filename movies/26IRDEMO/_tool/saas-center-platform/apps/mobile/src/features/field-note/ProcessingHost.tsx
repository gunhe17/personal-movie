import { useEffect, useRef } from 'react';
import { useFieldNotePlatform } from './platform/context';
import { useFieldNote } from './hooks';
import {
  useBackgroundProcessingStore,
  type ProcessingJob,
} from './backgroundProcessingStore';

/**
 * 진행 중인 필드노트 분석을 글로벌하게 polling 하는 호스트.
 * (main)/_layout 에 1회 마운트되어, 활성 job 마다 ProcessingJobWatcher 를 띄움.
 *
 * 사용자가 ProcessingScreen 에서 뒤로 가도 polling 이 끊기지 않으며,
 * 완료/실패 감지 시 글로벌 토스트로 알림 → 클릭 시 결과 화면으로 이동.
 */
export function ProcessingHost() {
  const jobs = useBackgroundProcessingStore((state) => state.jobs);
  return (
    <>
      {Object.values(jobs).map((job) => (
        <ProcessingJobWatcher key={job.fieldNoteId} job={job} />
      ))}
    </>
  );
}

function ProcessingJobWatcher({ job }: { job: ProcessingJob }) {
  const { centerId, notify, navigate } = useFieldNotePlatform();
  const removeJob = useBackgroundProcessingStore((s) => s.removeJob);

  // processing 상태로 useFieldNote 의 polling 활성화 (POLLING_INTERVAL_MS 주기)
  const { data: fieldNote } = useFieldNote(centerId, job.fieldNoteId, 'processing');

  // 중복 알림 방지 — 같은 job 에 대해 토스트는 1회만
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!fieldNote || notifiedRef.current) return;
    const status = fieldNote.processing_status;
    // 아직 처리 중이면 계속 폴링.
    if (status === 'processing') return;
    // 그 외(completed/failed/idle/skipped)는 모두 종료 상태 → 폴링 중단.
    // (전사만 자동 실행되면 처리 후 processing_status 가 'idle' 로 돌아오는데,
    //  예전엔 completed/failed 만 종료로 봐서 무한 폴링하던 버그.)

    notifiedRef.current = true;
    const label = job.label ?? '필드노트';

    // 완료/실패만 토스트로 알림. idle/skipped(전사만 끝)은 조용히 폴링만 중단.
    if (status === 'completed' || status === 'failed') {
      notify({
        type: status === 'completed' ? 'success' : 'error',
        message:
          status === 'completed'
            ? `${label} 분석이 완료됐어요`
            : `${label} 분석에 실패했어요`,
        durationMs: 5000,
        onPress: () => {
          if (job.scheduleId) navigate.toFieldNoteDetail(job.scheduleId);
          else navigate.toFieldNoteQuick(job.fieldNoteId);
        },
      });
    }

    // 더 이상 갱신될 상태 변화 없음 → polling 중단
    removeJob(job.fieldNoteId);
  }, [fieldNote, job, removeJob, notify, navigate]);

  return null;
}
