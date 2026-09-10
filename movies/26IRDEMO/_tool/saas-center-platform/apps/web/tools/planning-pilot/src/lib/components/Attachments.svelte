<script lang="ts">
  import type { Feature, SelectionItem, Attachment } from '$lib/types'
  import Wireframe from './Wireframe.svelte'
  let {
    planId,
    feature,
    item = $bindable(),
    onBusy,
    onMessage
  }: {
    planId: string
    feature: Feature
    item: SelectionItem
    onBusy: (value: boolean) => void
    onMessage: (value: string) => void
  } = $props()
  let uploading = $state(false)
  let error = $state('')
  async function upload(event: Event, kind: Attachment['kind']) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || uploading) return
    if (
      !['image/png', 'image/jpeg'].includes(file.type) ||
      file.size > 4 * 1024 * 1024
    ) {
      error = '4MB 이하 PNG 또는 JPG 이미지를 선택하세요.'
      return
    }
    if (item.attachments.length >= 3) {
      error = '이미지는 항목당 3개까지 첨부할 수 있습니다.'
      return
    }
    const target = item
    uploading = true
    onBusy(true)
    error = ''
    try {
      const response = await fetch('/api/plans/' + planId + '/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      target.attachments.push({ id: result.id, kind, caption: '' })
      onMessage('이미지를 첨부했습니다.')
    } catch (reason) {
      error = reason instanceof Error ? reason.message : '첨부 실패'
    } finally {
      uploading = false
      onBusy(false)
    }
  }
</script>

<details class="context-fold" open={item.attachments.length > 0}>
  <summary>화면 참고 · 이미지 첨부</summary>
  <div class="reference-section">
    <p class="section-label">현재 화면과 비교하기</p>
    {#if !item.attachments.some((attachment) => attachment.kind === 'current')}
      {#if feature.current.length}<Wireframe panels={feature.current} />
        <p class="muted">코드 기반 구조도 · 실제 화면 캡처가 아닙니다.</p>{/if}
    {/if}
    <div class="attachment-gallery">
      {#each item.attachments as attachment (attachment.id)}
        <figure>
          <figcaption>
            {attachment.kind === 'current'
              ? '현재 화면 · 사용자 첨부'
              : '다른 안 · 사용자 제안'}
          </figcaption>
          <a
            href={'/api/plans/' + planId + '/attachments/' + attachment.id}
            target="_blank"
            rel="noopener"
            aria-label="첨부 이미지 크게 보기"
            ><img
              src={'/api/plans/' + planId + '/attachments/' + attachment.id}
              alt={attachment.caption ||
                (attachment.kind === 'current'
                  ? '사용자가 첨부한 현재 화면'
                  : '사용자가 제안한 화면')}
            /></a
          >
          <input
            type="text"
            maxlength="1000"
            bind:value={attachment.caption}
            aria-label="이미지 설명"
            placeholder="확인할 위치나 이유를 적어주세요."
          />
          <button
            class="text-button"
            onclick={() =>
              (item.attachments = item.attachments.filter(
                (candidate) => candidate.id !== attachment.id
              ))}>첨부 삭제</button
          >
        </figure>
      {/each}
    </div>
    <div class="upload-actions">
      {#each ['current', 'proposal'] as kind}
        <input
          id={'upload-' + kind}
          class="sr-only"
          type="file"
          accept="image/png,image/jpeg"
          disabled={uploading || item.attachments.length >= 3}
          onchange={(event) => upload(event, kind as Attachment['kind'])}
        />
        <label for={'upload-' + kind} class="upload-label"
          >{kind === 'current'
            ? '현재 화면 첨부'
            : '다른 안 이미지 첨부'}</label
        >
      {/each}
    </div>
    <p class="muted">
      PNG·JPG, 각 4MB 이하 · 항목당 3개 · 개인정보가 없는 캡처를 사용하세요.
    </p>
    {#if uploading}<p role="status">첨부 중…</p>{/if}{#if error}<p
        class="pending-text"
        role="alert"
      >
        {error}
      </p>{/if}
  </div>
</details>
