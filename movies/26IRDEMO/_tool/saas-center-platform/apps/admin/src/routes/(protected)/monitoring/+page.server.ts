import { env } from '$env/dynamic/private'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  return {
    grafanaUrl: env.GRAFANA_URL || 'https://monitoring.mindscope.kr'
  }
}
