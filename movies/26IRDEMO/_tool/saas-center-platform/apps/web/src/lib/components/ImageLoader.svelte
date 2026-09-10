<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  export let image: {
    src?: string
    size?: 'cover' | 'contain'
  } = {}
  export let parentRatio = 1
  export let altText: string = 'image'

  let imageClass = ''
  let imageEl: HTMLImageElement

  $: if (image) {
    imageClass = getImageClass()
  }

  const getImageClass = () => {
    return twMerge(
      'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none',
      imageEl && getImageSizeClass(parentRatio)
    )
  }
  const getImageSizeClass = (parentRatio = 1) => {
    const { naturalWidth, naturalHeight } = imageEl
    const ratio = naturalWidth / naturalHeight
    const imageSize = image.size || 'cover'

    if (imageSize === 'cover' && ratio >= parentRatio) {
      return 'w-auto h-full'
    }

    if (imageSize === 'contain' && ratio < parentRatio) {
      return 'w-auto h-full'
    }

    return 'w-full h-auto'
  }
</script>

<img
  alt={altText}
  bind:this={imageEl}
  on:load={() => {
    imageClass = getImageClass()
  }}
  src={image.src}
  class={imageClass}
/>
