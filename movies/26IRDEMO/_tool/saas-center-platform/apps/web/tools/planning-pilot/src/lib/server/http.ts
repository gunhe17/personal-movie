import { json } from '@sveltejs/kit'
import { StoreError } from './store'
export async function body(request: Request, limit = 512000) {
  const reader = request.body?.getReader()
  if (!reader) throw new StoreError(400, '요청 내용이 없습니다.')
  let size = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.length
    if (size > limit) {
      await reader.cancel()
      throw new StoreError(413, '입력 내용이 너무 큽니다.')
    }
    chunks.push(chunk.value)
  }
  return Buffer.concat(chunks)
}
export async function input(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new StoreError(415, 'JSON 요청이 필요합니다.')
  return JSON.parse((await body(request)).toString('utf8'))
}
export async function respond(action: () => Promise<unknown>) {
  try {
    return json(await action())
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : '처리하지 못했습니다.',
        path: error instanceof StoreError ? error.path : undefined
      },
      { status: error instanceof StoreError ? error.status : 400 }
    )
  }
}
