<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import type { ClientDocumentItem } from '$lib/types/client'
  import TrashIcon24 from '$root/src/lib/assets/TrashIcon24.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'

  interface Props {
    documents: ClientDocumentItem[]
    onUploadClick: () => void
    onPreviewClick: (doc: ClientDocumentItem) => void
    onDownloadClick: (doc: ClientDocumentItem) => void
    onDeleteClick: (doc: ClientDocumentItem) => void
  }

  let {
    documents,
    onUploadClick,
    onPreviewClick,
    onDownloadClick,
    onDeleteClick
  }: Props = $props()
</script>

{#if documents.length === 0}
  <NoDataSection description="등록된 문서가 없어요">
    {#snippet actions()}
      <button
        onclick={onUploadClick}
        class="h-12 w-40 rounded-lg bg-gray-100 text-body-01-normal-medium text-gray-600 transition-colors hover:bg-gray-200"
      >
        파일 등록
      </button>
    {/snippet}
  </NoDataSection>
{:else}
  <div>
    <!-- 카운트 + 액션 행 — 회기 상세 '총 N개의 회기가 있어요' 행과 동일 규격
         (Body_01 Medium · text-body-default · 행 하단 12 · 버튼 40×110 primary) -->
    <div class="flex items-center justify-between pb-3">
      <Typography variant="body-01-normal-medium" color="text-body-default">
        총 {documents.length}개의 문서가 있어요
      </Typography>
      <button
        type="button"
        onclick={onUploadClick}
        class="inline-flex h-10 w-[110px] items-center justify-center gap-2 rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
      >
        <PlusIcon20 />
        <Typography
          variant="body-02-normal-medium"
          color="text-gray-600"
          tag="span"
        >
          파일 추가
        </Typography>
      </button>
    </div>
    <!-- 한 줄 3개 — 카드 폭은 컨테이너를 균등 분할해 꽉 채운다(고정폭 없음) -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {#each documents as document}
        <div
          class="flex h-full min-h-[140px] flex-col justify-between rounded-xl border border-gray-200 bg-white p-4"
        >
          <div>
            <!-- 상단: 작성 배지(좌) + 다운로드·삭제(우) -->
            <div class="flex items-start justify-between gap-2">
              <span
                class="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600"
              >
                작성
              </span>
              <div class="flex shrink-0 items-center gap-1">
                <Tooltip text="다운로드">
                  <button
                    onclick={() => onDownloadClick(document)}
                    aria-label="다운로드"
                    class="rounded p-0.5 hover:bg-gray-100 duration-200"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 2v8m0 0L5 7m3 3l3-3"
                        stroke="#8A949E"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M2.5 11v1.5a1 1 0 001 1h9a1 1 0 001-1V11"
                        stroke="#8A949E"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                </Tooltip>
                <Tooltip text="삭제">
                  <button
                    onclick={() => onDeleteClick(document)}
                    aria-label="삭제"
                    class="rounded hover:bg-gray-50 duration-200"
                  >
                    <TrashIcon24 />
                  </button>
                </Tooltip>
              </div>
            </div>

            <Typography
              variant="body-01-semibold"
              color="text-[#474C53]"
              className="mt-3 block truncate-safe"
            >
              {document.title}
            </Typography>
          </div>

          <!-- 하단: 수정하기 (미리보기/편집) -->
          <button
            type="button"
            onclick={() => onPreviewClick(document)}
            class="mt-4 w-full rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            수정
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}
