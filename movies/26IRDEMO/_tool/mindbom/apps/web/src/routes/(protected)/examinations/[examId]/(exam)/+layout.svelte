<script lang="ts">
  /**
   * 검사 진행 화면 공통 레이아웃.
   *
   * 검사 종류별로 layout을 두지 않는다 — +layout.ts가 exam_type을 확정해 주므로
   * 여기서는 레지스트리에서 모듈을 골라 컨텍스트에 실어주기만 한다.
   * 자식([step])은 모듈이 지정한 컴포넌트를 렌더한다.
   */
  import { page } from '$app/state'
  import { institutionId } from '$lib/stores/institution.store'
  import { getExamModule } from '$lib/features/examination/core/registry'
  import {
    createExamContext,
    setExamContext
  } from '$lib/features/examination/core/exam-context.svelte'

  let { data, children } = $props()

  // 모듈과 초기 exam은 진입 시점에 확정된다(검사가 바뀌면 layout이 다시 만들어진다).
  const module = getExamModule(data.examType)
  const initialExam = data.exam

  const { ctx, initialize } = createExamContext({
    examId: () => data.examId,
    institutionId: () => $institutionId,
    module,
    activeStep: () => page.params.step ?? '',
    // +layout.ts가 이미 받아 온 exam을 씨앗으로 넘긴다(초기값 1회).
    // 이후 갱신은 refreshExam()이 담당하므로 반응형으로 읽지 않는다.
    initialExam: initialExam
  })

  // setContext는 컴포넌트 초기화 중에 불려야 한다.
  setExamContext(ctx)

  // 로드는 effect가 소유한다 — 기관이 늦게 준비되는 경우를 위해 반응형으로 둔다.
  $effect(() => {
    void $institutionId
    void initialize()
  })
</script>

{@render children()}
