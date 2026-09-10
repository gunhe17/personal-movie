import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,
      envPrefix: ''
    }),
    alias: {
      '$root/*': './*',
      '$services/*': 'src/lib/services/*',
      '$types/*': 'src/lib/types/*',
      '$stores/*': 'src/lib/stores/*',
      '$utils/*': 'src/lib/utils/*',
      '$components/*': 'src/lib/components/*',
      '$hooks/*': 'src/lib/hooks/*'
    }
  }
}

export default config
