<script lang="ts">
  import { goto } from '$app/navigation'
  import ArrowLeftIcon24 from '$lib/assets/ArrowLeftIcon24.svelte'
  import MindScopeLogo from '$lib/assets/MindScopeLogo.svelte'
  import BuildingIcon54 from '$root/src/lib/assets/BuildingIcon54.svelte'
  import CircleCheckBlueIcon from '$lib/assets/CircleCheckBlueIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
</script>

<!-- 헤더 -->
<header
  class="flex h-16 items-center gap-2 border-b border-gray-100 bg-white px-4"
>
  <Tooltip text="뒤로가기">
    <button
      type="button"
      onclick={() => goto('/welcome')}
      class="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50"
      aria-label="뒤로가기"
    >
      <ArrowLeftIcon24 />
    </button>
  </Tooltip>
  <MindScopeLogo />
</header>

<div
  class="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-gray-50 px-4 py-8"
>
  <div class="w-full max-w-md">
    <div
      class="w-[544px] px-[40px] rounded-lg border border-gray-200 bg-white py-10 shadow-sm"
    >
      <div class="flex flex-col items-center text-center">
        <BuildingIcon54 />

        <Typography
          variant="headline-01-normal-semibold"
          color="text-gray-900"
          className="mt-[14px] mb-[10px]"
        >
          센터 등록 신청이 완료되었어요!
        </Typography>
        <Typography variant="body-01-reading-regular" color="text-gray-500">
          제출한 정보가 승인되면 서비스를 이용할 수 있어요.
        </Typography>
      </div>

      <!-- 단계 안내 (타임라인) -->
      <div class="mt-8 flex flex-col">
        <!-- 1단계: 완료 -->
        <div class="flex items-center gap-4">
          <CircleCheckBlueIcon width={28} height={28} />
          <div class="flex flex-col gap-[10px]">
            <Typography variant="body-01-medium" color="text-gray-800"
              >신청서 제출 완료</Typography
            >
            <Typography variant="body-02-regular" color="text-gray-600">
              제출해주신 정보를 검토해요
            </Typography>
          </div>
        </div>

        <!-- 연결선 1→2 -->
        <div class="ml-[13px] w-px bg-primary-200" style="height: 24px;"></div>

        <!-- 2단계 -->
        <div class="flex items-center gap-4">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption-01-normal-semibold text-primary-400"
            >2</span
          >
          <div class="flex flex-col gap-[10px]">
            <Typography variant="body-01-medium" color="text-gray-800"
              >관리자 승인 대기</Typography
            >
            <Typography variant="body-02-regular" color="text-gray-600">
              검토 완료까지 영업일 기준 1-3일 소요돼요
            </Typography>
          </div>
        </div>

        <!-- 연결선 2→3 -->
        <div class="ml-[13px] w-px bg-gray-200" style="height: 24px;"></div>

        <!-- 3단계 -->
        <div class="flex items-center gap-4">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption-01-normal-semibold text-primary-400"
            >3</span
          >
          <div class="flex flex-col gap-[10px]">
            <Typography variant="body-01-medium" color="text-gray-800"
              >승인 결과 안내</Typography
            >
            <Typography variant="body-02-regular" color="text-gray-600">
              이메일로 승인 결과를 안내해드려요
            </Typography>
          </div>
        </div>
      </div>

      <!-- 안내사항 -->
      <div class="mt-6 rounded-lg bg-gray-50 px-4 py-3">
        <Typography
          variant="body-03-medium"
          color="text-gray-700"
          className="mb-[10px]">안내사항</Typography
        >
        <ul
          class="mt-2 flex flex-col gap-1 text-body-03-normal-regular text-gray-500"
        >
          <li class="flex items-start gap-1.5">
            <span class="shrink-0">•</span>
            <Typography variant="body-03-regular" color="text-gray-500"
              >승인 과정에서 추가 서류 요청이 있을 수 있어요</Typography
            >
          </li>
          <li class="flex items-start gap-1.5">
            <span class="shrink-0">•</span>
            <Typography variant="body-03-regular" color="text-gray-500"
              >승인 완료 후 센터 관리자 계정이 활성화돼요.</Typography
            >
          </li>
          <li class="flex items-start gap-1.5">
            <span class="shrink-0">•</span>
            <Typography variant="body-03-regular" color="text-gray-500"
              >추가 문의 사항은 고객센터로 문의해주세요</Typography
            >
          </li>
        </ul>
      </div>

      <!-- 확인 버튼 -->
      <button
        type="button"
        onclick={() => goto('/welcome')}
        class="mt-6 h-[52px] w-full rounded-lg bg-primary-500 text-body-02-normal-medium font-medium text-white transition hover:bg-primary-600"
      >
        확인
      </button>
    </div>
  </div>
</div>
