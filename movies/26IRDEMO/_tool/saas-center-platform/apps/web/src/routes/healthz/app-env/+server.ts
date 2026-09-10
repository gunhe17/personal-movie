import { json } from '@sveltejs/kit'
import { resolveAppEnv, showSubscription, showAiFeatures } from '$lib/config/environment'

export const GET = ({ url }: { url: URL }) =>
  json({
    appEnv: resolveAppEnv(url.hostname),
    showSubscription: showSubscription(url.hostname),
    showAiFeatures: showAiFeatures(url.hostname)
  })
