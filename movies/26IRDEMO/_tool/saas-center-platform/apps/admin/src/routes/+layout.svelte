<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { browser } from '$app/environment'

  import { auth } from '$lib/stores/auth'
  import AdminSidebar from '$lib/components/AdminSidebar.svelte'
  import Snackbar from '$lib/components/Snackbar.svelte'
  import ModalContainer from '$lib/components/modal/ModalContainer.svelte'
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query'
  import type { LayoutData } from './$types'

  let { children, data }: { children: any; data: LayoutData } = $props()

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: browser,
        refetchOnWindowFocus: false,
        retry: 0,
        experimental_prefetchInRender: true
      }
    }
  })

  const hideLayoutPaths = ['/login', '/accept-admin-invitation', '/change-password']

  const shouldHideLayout = $derived(
    hideLayoutPaths.some((path) => page.url.pathname.startsWith(path))
  )

  onMount(() => {
    if (data.user) {
      auth.login(data.user)
    }
  })
</script>

<QueryClientProvider client={queryClient}>
  {#if shouldHideLayout}
    {@render children?.()}
  {:else}
    <div class="flex h-screen overflow-x-hidden bg-gray-50">
      <AdminSidebar />

      <main
        class="flex-1 flex flex-col min-h-0 transition-all duration-200"
        style="margin-left: var(--sidebar-width, 240px)"
      >
        <div class="flex-1 overflow-y-auto">
          {@render children?.()}
        </div>
      </main>
    </div>
  {/if}

  <ModalContainer />
  <Snackbar />
</QueryClientProvider>
