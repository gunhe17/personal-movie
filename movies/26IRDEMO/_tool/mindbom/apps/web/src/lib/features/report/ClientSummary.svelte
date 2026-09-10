<script lang="ts">
  /**
   * 사이드바 바닥의 내담자 요약.
   *
   * 검사 진행 화면(ExamLayoutShell)의 같은 자리와 형태를 맞춘 것이다 —
   * h-16이라 헤더와 규격이 맞고, 아바타로 시선을 걸고 이름을 키운다.
   *
   * 마스킹 토글은 두지 않는다. 검사 화면과 다른 점인데, 보고서 본문에는
   * 실명이 그대로 실리는 화면이라 이름만 가려도 소용이 없다.
   */
  import PersonAvatar from '$lib/components/ui/PersonAvatar.svelte'
  import { calcAge, clientCode, genderLabel } from '$lib/utils/format'
  import type { ClientInfo } from './materials'

  interface Props {
    client: ClientInfo | null
    /** 로드 완료 여부. false면 스켈레톤을 보여준다. */
    loaded: boolean
  }

  let { client, loaded }: Props = $props()
</script>

<div class="flex h-16 shrink-0 items-center border-t border-chrome-line px-5">
  <div class="flex w-full items-center gap-3">
    {#if !loaded}
      <div class="h-10 w-10 shrink-0 animate-pulse rounded-full bg-chrome-hover"></div>
      <div class="min-w-0 flex-1">
        <div class="h-4 w-24 animate-pulse rounded bg-chrome-hover"></div>
        <div class="mt-1.5 h-3 w-32 animate-pulse rounded bg-chrome-hover"></div>
      </div>
    {:else if client}
      <PersonAvatar
        name={client.name}
        gender={client.gender}
        role="client"
        size={40}
      />
      <div class="min-w-0 flex-1">
        <p class="flex items-baseline gap-1.5 leading-snug">
          <span class="truncate text-body-02-normal-semibold text-chrome-fg">
            {client.name}
          </span>
          <span class="shrink-0 text-label-02-normal-regular text-chrome-fg-3">
            {clientCode(client.id)}
          </span>
        </p>
        <p
          class="mt-0.5 truncate text-label-01-normal-regular leading-snug text-chrome-fg-2"
        >
          {#if calcAge(client.birth_date) !== null}만 {calcAge(
              client.birth_date
            )}세{:else}만 -{/if}
          · {genderLabel(client.gender)}
        </p>
      </div>
    {:else}
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chrome-hover text-chrome-fg-3"
      >
        <span class="material-icons-round text-xl">person</span>
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-body-02-normal-semibold leading-snug text-chrome-fg-3">
          내담자 없음
        </p>
        <p class="mt-0.5 text-label-01-normal-regular leading-snug text-chrome-fg-3">
          —
        </p>
      </div>
    {/if}
  </div>
</div>
