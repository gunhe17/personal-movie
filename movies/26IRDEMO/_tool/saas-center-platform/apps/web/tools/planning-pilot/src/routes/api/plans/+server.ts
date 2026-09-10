import { store } from '$lib/server/store'
import { input, respond } from '$lib/server/http'
import type { RequestHandler } from './$types'
export const POST: RequestHandler = ({ request }) =>
  respond(async () => store.create(await input(request)))
