import { readFile } from 'node:fs/promises'
import { store } from '$lib/server/store'
import type { RequestHandler } from './$types'
export const GET: RequestHandler = async ({ params }) => {
  try {
    await store.getPlan(params.planId)
    const image = await readFile(
      await store.imagePath(params.planId, params.imageId)
    )
    return new Response(image, {
      headers: {
        'Content-Type': params.imageId.endsWith('.png')
          ? 'image/png'
          : 'image/jpeg'
      }
    })
  } catch {
    return new Response('이미지를 찾을 수 없습니다.', { status: 404 })
  }
}
