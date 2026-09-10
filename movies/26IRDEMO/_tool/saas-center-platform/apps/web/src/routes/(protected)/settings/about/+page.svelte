<script lang="ts">
  import { fade } from 'svelte/transition'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { changelog } from '$lib/constants/changelog'
  import OpenSourceLicenseModal from '$lib/components/modal/OpenSourceLicenseModal.svelte'
  import ChangelogModal from '$lib/components/modal/ChangelogModal.svelte'

  const appVersion = __APP_VERSION__
  const buildTime = __BUILD_TIME__
  const buildEnv = __BUILD_ENV__
  const gitSha = __GIT_SHA__

  const buildDate = new Date(buildTime).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const envLabel: Record<string, string> = {
    development: '개발',
    staging: '스테이징',
    production: '운영'
  }

  const latestEntry = $derived(changelog[0])

  function openChangelogModal() {
    modalStore.open({
      component: ChangelogModal,
      props: {},
      options: { size: 'lg' }
    })
  }

  function openLicenseModal() {
    modalStore.open({
      component: OpenSourceLicenseModal,
      props: {},
      options: { size: 'sm' }
    })
  }
</script>

<div in:fade class="mx-auto flex max-w-[640px] flex-col">
  <PageTitleSection title="시스템 정보" className="mb-4" />

  <!-- 버전 정보 -->
  <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden">
    <div class="border-b border-gray-50 px-6 py-5">
      <h2 class="text-title-01-normal-semibold text-gray-900">버전 정보</h2>
    </div>

    <div class="px-6 py-2">
      <dl class="divide-y divide-gray-100">
        <div class="flex items-center justify-between py-4">
          <dt class="text-body-03-normal-medium text-gray-500">앱 버전</dt>
          <dd class="text-body-03-normal-medium text-gray-900">
            v{appVersion}
          </dd>
        </div>
        <div class="flex items-center justify-between py-4">
          <dt class="text-body-03-normal-medium text-gray-500">빌드 날짜</dt>
          <dd class="text-body-03-normal-regular text-gray-900">{buildDate}</dd>
        </div>
        <div class="flex items-center justify-between py-4">
          <dt class="text-body-03-normal-medium text-gray-500">환경</dt>
          <dd>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-label-02-normal-medium
                {buildEnv === 'production'
                ? 'bg-green-100 text-green-800'
                : buildEnv === 'staging'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'}"
            >
              {envLabel[buildEnv] ?? buildEnv}
            </span>
          </dd>
        </div>
        <div class="flex items-center justify-between py-4">
          <dt class="text-body-03-normal-medium text-gray-500">빌드 ID</dt>
          <dd class="font-mono text-body-03-normal-regular text-gray-500">
            {gitSha}
          </dd>
        </div>
      </dl>
    </div>
  </div>

  <!-- 최근 업데이트 -->
  <div class="mt-5 rounded-2xl border border-gray-200 bg-white overflow-hidden">
    <div
      class="flex items-center justify-between border-b border-gray-50 px-6 py-5"
    >
      <h2 class="text-title-01-normal-semibold text-gray-900">최근 업데이트</h2>
      {#if changelog.length > 1}
        <button
          type="button"
          class="text-body-03-normal-regular text-primary-600 transition-colors hover:text-primary-700"
          onclick={openChangelogModal}
        >
          전체 보기
        </button>
      {/if}
    </div>

    <div class="px-6 py-5">
      {#if latestEntry}
        <div>
          <div class="flex items-center gap-2.5 mb-2">
            <span
              class="inline-flex items-center rounded-md bg-primary-50 px-2 py-0.5 text-label-02-normal-bold text-primary-700"
            >
              v{latestEntry.version}
            </span>
            <span class="text-label-02-normal-regular text-gray-400"
              >{latestEntry.date}</span
            >
          </div>
          {#if latestEntry.summary}
            <p class="text-body-02-normal-medium text-gray-900 mb-2.5">
              {latestEntry.summary}
            </p>
          {/if}
          <ul class="space-y-1.5">
            {#each latestEntry.changes as change}
              <li
                class="flex items-start gap-2 text-body-03-normal-regular text-gray-600"
              >
                <svg
                  class="mt-0.5 h-4 w-4 shrink-0 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="m9 5 7 7-7 7"
                  />
                </svg>
                <span>{change}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>

  <!-- 법률 정보 및 지원 -->
  <div class="mt-5 rounded-2xl border border-gray-200 bg-white overflow-hidden">
    <div class="border-b border-gray-50 px-6 py-5">
      <h2 class="text-title-01-normal-semibold text-gray-900">
        법률 정보 및 지원
      </h2>
    </div>

    <div class="px-6 py-2">
      <ul class="divide-y divide-gray-100">
        <li>
          <a
            href="/terms"
            target="_blank"
            class="-mx-6 flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50"
          >
            <span class="text-body-03-normal-regular text-gray-700"
              >이용약관</span
            >
            <svg
              class="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
          </a>
        </li>
        <li>
          <a
            href="/privacy"
            target="_blank"
            class="-mx-6 flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50"
          >
            <span class="text-body-03-normal-regular text-gray-700"
              >개인정보처리방침</span
            >
            <svg
              class="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
          </a>
        </li>
        <li>
          <button
            type="button"
            class="-mx-6 flex w-[calc(100%+3rem)] items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
            onclick={openLicenseModal}
          >
            <span class="text-body-03-normal-regular text-gray-700"
              >오픈소스 라이선스</span
            >
            <svg
              class="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </li>
        <li>
          <a
            href="/support"
            class="-mx-6 flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50"
          >
            <span class="text-body-03-normal-regular text-gray-700"
              >고객 지원 및 피드백</span
            >
            <svg
              class="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
          </a>
        </li>
      </ul>
    </div>
  </div>

  <!-- 저작권 (하단 중앙) -->
  <div class="mt-8 mb-8 text-center">
    <p class="text-label-02-normal-regular text-gray-400">
      &copy; {new Date().getFullYear()} Insighter Corporation. All rights reserved.
    </p>
  </div>
</div>
