# Architecture & Development Guide

상세한 아키텍처 문서와 개발 가이드입니다.

---

## API Layer Architecture (Reusable Pattern)

### 1. Query Client Configuration

**Location**: `src/routes/+layout.svelte`

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
import { browser } from '$app/environment';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      enabled: browser,                    // SSR-safe: prevent server-side execution
      refetchOnWindowFocus: false,         // Disable auto-refetch on window focus
      retry: 0,                            // No automatic retries
      experimental_prefetchInRender: true  // Svelte 5 compatibility
    }
  }
});
```

### 2. Action Pattern (API Endpoint Definition)

**Location**: `src/lib/hooks/actions/*.action.ts`

Each API endpoint is defined as an `Action` object:

```typescript
// src/lib/types/apiResponse.ts
export type Action<T, TResponse = ApiResponse<T>> = {
  key?: string[];                              // Query keys for caching/invalidation
  request: (params?: any) => Promise<TResponse>; // Axios request function
};

// Example action definition (src/lib/hooks/actions/member.action.ts)
export const getMemberList = (): Action<MemberListResponse> => ({
  key: ['getMemberList'],
  request: (params: { center_id: string }) =>
    appInstance.get(`/members`, { params }).then((res) => res.data)
});

export const postCreateMember = (): Action<CreateMemberResponse> => ({
  key: ['postCreateMember'],
  request: (payload: CreateMemberPayload) =>
    appInstance.post('/members', payload).then((res) => res.data)
});
```

### 3. Query Builder (Data Fetching)

**Location**: `src/lib/hooks/queries/builder.ts`

```typescript
import { createQuery, keepPreviousData } from '@tanstack/svelte-query';

export const queryBuilder = <T, TResponse = ApiResponse<T>>(
  action: () => Action<T, TResponse>,
  keyId?: number | string | (number | string)[] | object | (() => any),
  queryOptions?: object
) => {
  const { key, request } = action();

  // Reactive key resolution for dynamic parameters
  const resolvedKeyId = typeof keyId === 'function' ? keyId() : keyId;
  const queryKey = key ? [...key, resolvedKeyId].filter(Boolean) : [];

  return createQuery({
    queryKey,
    queryFn: () => request(resolvedKeyId),
    placeholderData: keepPreviousData,
    ...queryOptions
  });
};
```

**Usage in Components**:

```typescript
// Simple query
const memberList = $derived(queryBuilder(getMemberList, { center_id: centerId }));

// Reactive query with dynamic parameters
const clientDetail = $derived(queryBuilder(getClientDetail, () => clientId));

// Access query state
$effect(() => {
  if (memberList.isSuccess) {
    members = memberList.data.data;
  }
});
```

### 4. Mutation Builder (Data Modification)

**Location**: `src/lib/hooks/queries/builder.ts`

```typescript
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { showErrorSnackbar, showSuccessSnackbar } from '$lib/utils/errorHandler';

export const mutationBuilder = <T>(
  action: () => Action<T>,
  useInvalidate?: QueryKey,
  extraInvalidate?: QueryKey[],
  options?: {
    successMessage?: string;
    errorMessage?: string;
    autoReset?: boolean;
    showError?: boolean;
  }
) => {
  const client = useQueryClient();
  const { key, request } = action();

  const mutation = createMutation({
    mutationFn: request,
    onSuccess: () => {
      // Auto-invalidate related queries
      const keysToInvalidate = [
        ...(key || []),
        ...(useInvalidate ? [useInvalidate] : []),
        ...(extraInvalidate || [])
      ];

      keysToInvalidate.forEach((queryKey) => {
        client.invalidateQueries({ queryKey: [queryKey].flat(), exact: false });
      });

      if (options?.successMessage) {
        showSuccessSnackbar(options.successMessage);
      }
    },
    onError: (error) => {
      if (options?.showError !== false) {
        showErrorSnackbar(error, options?.errorMessage);
      }
    }
  });

  return mutation;
};
```

**Usage in Components**:

```typescript
// Create mutation
const createMemberMutation = mutationBuilder(
  postCreateMember,
  ['getMemberList'],        // Primary invalidation key
  ['getMemberDetail'],      // Extra invalidation keys
  {
    successMessage: '회원이 등록되었습니다.',
    errorMessage: '회원 등록에 실패했습니다.'
  }
);

// Execute mutation
createMemberMutation.mutate({ name: '홍길동', email: 'test@test.com' });

// Track mutation state
{#if createMemberMutation.isPending}
  <Spinner />
{/if}
```

### 5. Axios Instances & Interceptors

**Location**: `src/lib/services/api/instances.ts`

```typescript
import axios from 'axios';
import { setupInterceptors } from './interceptors';

export const appInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

export const externalInstance = axios.create({
  baseURL: '/external-api',
  timeout: 30000
});

// Apply interceptors to both instances
setupInterceptors(appInstance);
setupInterceptors(externalInstance);
```

**Location**: `src/lib/services/api/interceptors.ts`

```typescript
export const setupInterceptors = (instance: AxiosInstance) => {
  // Request Interceptor: JWT token injection & refresh
  instance.interceptors.request.use(async (config) => {
    const accessToken = getCookie('access_token');

    if (accessToken && isTokenExpired(accessToken)) {
      const refreshToken = getCookie('refresh_token');

      if (refreshToken && !isTokenExpired(refreshToken)) {
        const newToken = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${newToken}`;
      } else {
        // Both tokens expired → logout
        await logout();
        window.location.href = '/login';
        return Promise.reject(new Error('Session expired'));
      }
    } else if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  });

  // Response Interceptor: 401 handling
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await logout();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
};
```

### 6. Error Handler Utilities

**Location**: `src/lib/utils/errorHandler.ts`

```typescript
import { snackbarStore } from '$lib/stores/snackbar';

// Extract error message from various response formats
export const extractErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.meta?.message ||
    error?.response?.data?.message ||
    error?.message ||
    '요청 처리 중 오류가 발생했습니다.'
  );
};

// Show error notification
export const showErrorSnackbar = (error: any, defaultMessage?: string): void => {
  const message = defaultMessage || extractErrorMessage(error);
  snackbarStore.error(message);
};

// Show success notification
export const showSuccessSnackbar = (message: string): void => {
  snackbarStore.success(message);
};
```

### 7. API Response Types

**Location**: `src/lib/types/apiResponse.ts`

```typescript
// Standard API response format
export type ApiResponse<T> = {
  success: boolean;
  data: T;
  meta?: {
    message?: string;
    code?: string;
  };
};

// Paginated response format
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

// Server paginated response (pagination at top level)
export type ServerPaginatedResponse<T> = {
  data: T[];
  pagination: PaginationType;
};
```

### 8. Query Key Strategy

**Naming Convention**:
- Simple keys: `['entityName']` (e.g., `['members']`, `['assessments']`)
- Detail keys: `['entityName', id]` (e.g., `['members', memberId]`)
- Filtered keys: `['entityName', filterObject]` (e.g., `['members', { centerId }]`)

**Invalidation Patterns**:
```typescript
// Invalidate all related queries (prefix matching)
client.invalidateQueries({ queryKey: ['members'], exact: false });

// Invalidate specific query
client.invalidateQueries({ queryKey: ['members', memberId], exact: true });

// Invalidate multiple query groups
['members', 'memberDetail', 'memberStats'].forEach((key) =>
  client.invalidateQueries({ queryKey: [key], exact: false })
);
```

---

## Component Development Guidelines

### Component Directory Structure

```
src/lib/components/
├── modal/              # Modal/Dialog components
│   ├── BaseModal.svelte        # Base wrapper for all modals
│   ├── ConfirmModal.svelte     # Confirmation dialog
│   ├── *RegisterModal.svelte   # Form modals (Member, Client, etc.)
│   └── ModalContainer.svelte   # Global modal renderer
├── cards/              # Data display cards
├── assessment/         # Assessment-specific components
│   └── cells/          # Table cell components
├── calendar/           # Calendar components
├── filter/             # Filter UI components
├── list/               # List display components
├── home/               # Dashboard components
├── ui/                 # Generic UI primitives
└── [root-level]        # Core components (Button, Select, Table, etc.)
```

### Naming Conventions

| Pattern | Usage | Examples |
|---------|-------|----------|
| **PascalCase** | All component files | `Button.svelte`, `MemberRegisterModal.svelte` |
| **-Modal suffix** | Dialog components | `ConfirmModal.svelte`, `ClientRegisterModal.svelte` |
| **-Card suffix** | Card components | `AssessmentCaseCard.svelte`, `RoomCard.svelte` |
| **-Table suffix** | Table components | `AssessmentStatusTable.svelte` |
| **Domain folders** | Feature-specific | `assessment/`, `calendar/`, `home/` |

---

## UI Component Library

### Available Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Button` | `components/Button.svelte` | Action buttons with variants |
| `Select` | `components/Select.svelte` | Dropdown select with filtering |
| `Checkbox` | `components/Checkbox.svelte` | Custom styled checkbox |
| `Switch` | `components/Switch.svelte` | Toggle switch |
| `Table` | `components/Table.svelte` | Data table with selection |
| `Snackbar` | `components/Snackbar.svelte` | Toast notifications |
| `Pagination` | `components/Pagination.svelte` | Page navigation |
| `CountStepper` | `components/CountStepper.svelte` | Number input with +/- |
| `Slider` | `components/Slider.svelte` | Range input slider |

### Button Component

```svelte
<script>
import Button from '$lib/components/Button.svelte'
</script>

<!-- Variants -->
<Button color="primary" size="lg">Primary</Button>
<Button color="dark" size="md" outline>Outlined</Button>
<Button color="light" size="sm" pill>Rounded</Button>

<!-- States -->
<Button loading={isSubmitting}>저장</Button>
<Button disabled={!isValid}>제출</Button>

<!-- As link -->
<Button href="/dashboard">대시보드로 이동</Button>
```

**Props**:
- `color`: `'primary' | 'dark' | 'light'`
- `size`: `'xs' | 'sm' | 'md' | 'lg'`
- `outline`: boolean - Outlined style
- `pill`: boolean - Rounded corners
- `loading`: boolean - Show loading spinner
- `disabled`: boolean - Disable button
- `weight`: `'bold' | 'medium' | 'normal'`
- `href`: string - Convert to link

### Select Component

```svelte
<script>
import Select from '$lib/components/Select.svelte'

let selectedRole = $state('SPECIALIST')
const roleOptions = [
  { value: 'CENTER', label: '센터장' },
  { value: 'MANAGER', label: '관리자' },
  { value: 'SPECIALIST', label: '상담사' }
]
</script>

<Select
  options={roleOptions}
  bind:selected={selectedRole}
  placeholder="역할을 선택하세요"
  on:change={(e) => console.log(e.detail)}
/>

<!-- Simple string options -->
<Select options={['옵션1', '옵션2', '옵션3']} bind:selected={value} />
```

**Props**:
- `options`: `string[] | { value: string, label: string }[]`
- `selected`: Bindable selected value
- `placeholder`: Placeholder text
- `disabled`: boolean
- `defaultValue`: Default value for active state detection

### Checkbox Component

```svelte
<script>
import Checkbox from '$lib/components/Checkbox.svelte'

let isAgreed = $state(false)
</script>

<Checkbox bind:checked={isAgreed} onchange={(v) => console.log(v)} />
<Checkbox checked={true} readonly />
```

### Table Component

```svelte
<script>
import Table from '$lib/components/Table.svelte'
import type { TableColumn } from '$lib/components/Table.svelte'

let selectedIds = $state<string[]>([])

const columns: TableColumn[] = [
  { key: 'name', label: '이름', width: '150px' },
  { key: 'email', label: '이메일', width: '200px' },
  {
    key: 'actions',
    label: '관리',
    render: actionRenderSnippet
  }
]
</script>

<Table
  {columns}
  data={members}
  showCheckbox={true}
  bind:selectedIds
  onRowClick={(item) => goto(`/member/${item.id}`)}
/>
```

---

## Form Handling Pattern

### Input Field Pattern (No Dedicated Input Component)

```svelte
<script>
let memberName = $state('')
let email = $state('')
</script>

<!-- Standard text input -->
<input
  type="text"
  bind:value={memberName}
  placeholder="이름을 입력해주세요"
  class="text-title-02-regular h-13 w-full rounded-xl border border-gray-200 px-4
         focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
/>

<!-- Email input -->
<input
  type="email"
  bind:value={email}
  placeholder="이메일을 입력해주세요"
  class="..."
/>
```

### Radio Button Pattern (Custom Implementation)

```svelte
<script>
let gender = $state<'male' | 'female'>('male')
</script>

<div class="flex gap-4">
  <button onclick={() => (gender = 'male')} class="flex items-center gap-2">
    <div class="flex h-6 w-6 items-center justify-center rounded-full transition-colors
                {gender === 'male' ? 'bg-primary-500' : 'border border-gray-300 bg-white'}">
      {#if gender === 'male'}
        <svg class="h-4 w-4 text-white"><!-- checkmark --></svg>
      {/if}
    </div>
    <span>남자</span>
  </button>

  <button onclick={() => (gender = 'female')} class="flex items-center gap-2">
    <!-- Same pattern for female -->
  </button>
</div>
```

### Form State Management (Svelte 5 Runes)

```svelte
<script lang="ts">
// Local reactive state
let memberName = $state('')
let email = $state('')
let role = $state<'CENTER' | 'MANAGER' | 'SPECIALIST'>('SPECIALIST')

// Bindable props (for component inputs)
let checked = $bindable(false)

// Derived state
let isFormValid = $derived(memberName.length > 0 && email.includes('@'))

// Side effects
$effect(() => {
  if (isFormValid) {
    console.log('Form is now valid')
  }
})
</script>
```

---

## Error & Feedback Handling

### Snackbar Store (Toast Notifications)

**Location**: `src/lib/stores/snackbar.ts`

```typescript
import { snackbarStore } from '$lib/stores/snackbar'

// Success notification (2초 자동 닫힘)
snackbarStore.success('회원이 등록되었습니다.')

// Error notification (3초 자동 닫힘)
snackbarStore.error('등록에 실패했습니다.')

// Warning notification (2.5초 자동 닫힘)
snackbarStore.warning('입력값을 확인해주세요.')

// Info notification (2초 자동 닫힘)
snackbarStore.info('처리 중입니다.')

// With custom duration (ms)
snackbarStore.success('완료!', 5000)

// With action link
snackbarStore.error('권한이 없습니다.', { text: '권한 요청', href: '/settings/permissions' })
```

### Error Handling Strategy

**IMPORTANT**: This project uses **Snackbar (toast)** for ALL error feedback.
- No inline field validation errors below inputs
- All errors displayed via snackbar notifications

```typescript
// In mutation onError - automatically handled by mutationBuilder
const createMember = mutationBuilder(
  postCreateMember,
  ['getMemberList'],
  [],
  {
    successMessage: '회원이 등록되었습니다.',
    errorMessage: '회원 등록에 실패했습니다.'
  }
)

// Manual error handling
try {
  await someAsyncOperation()
} catch (error) {
  showErrorSnackbar(error)  // Uses extractErrorMessage internally
}

// Custom validation error
if (!memberName) {
  snackbarStore.error('이름을 입력해주세요.')
  return
}
```

### Error Extraction Utility

```typescript
import { extractErrorMessage, showErrorSnackbar, showSuccessSnackbar } from '$lib/utils/errorHandler'

// Extract message from various API response formats
const message = extractErrorMessage(error)
// Checks: error.response.data.meta.message → error.response.data.message → error.message → default

// Quick helpers
showErrorSnackbar(error)                    // Auto-extract message
showErrorSnackbar(error, '커스텀 메시지')    // Override with custom message
showSuccessSnackbar('저장되었습니다.')
```

### Form Submission Pattern

```svelte
<script>
const createMutation = mutationBuilder(
  postCreateMember,
  ['getMemberList'],
  [],
  {
    successMessage: '회원이 등록되었습니다.',
    errorMessage: '회원 등록에 실패했습니다.'
  }
)

const handleSubmit = () => {
  // 1. Client-side validation (show snackbar for errors)
  if (!memberName.trim()) {
    snackbarStore.error('이름을 입력해주세요.')
    return
  }

  if (!email.includes('@')) {
    snackbarStore.error('올바른 이메일 형식이 아닙니다.')
    return
  }

  // 2. Submit - success/error handled by mutationBuilder
  createMutation.mutate({
    name: memberName,
    email: email
  }, {
    onSuccess: () => closeModal()
  })
}
</script>

<Button onclick={handleSubmit} loading={createMutation.isPending}>
  등록
</Button>
```

---

## Modal Pattern

### Modal Store Usage

**Location**: `src/lib/stores/modal.ts`

```typescript
import { modalStore } from '$lib/stores/modal'
import MemberRegisterModal from '$lib/components/modal/MemberRegisterModal.svelte'

// Fire and forget
modalStore.open({
  component: MemberRegisterModal,
  props: { centerId: '123' },
  options: { size: 'lg' }
})

// Promise-based (wait for result)
const result = await modalStore.openWithPromise(
  ConfirmModal,
  { message: '삭제하시겠습니까?' },
  { size: 'sm' }
)
if (result) {
  // User confirmed
}
```

**Modal Size Options**:
- `'sm'` | `'md'` | `'lg'` | `'xl'` | `'wide'` | `'wideXl'`
- `'custom500'` | `'tall'` | `'narrow'` | `'fit'` | `'full'`
- Custom: `{ customWidth: 600, customHeight: 400 }`

### Form Modal Template

```svelte
<!-- src/lib/components/modal/EntityRegisterModal.svelte -->
<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Button from '../Button.svelte'
  import Select from '../Select.svelte'
  import Typography from '../Typography.svelte'
  import { mutationBuilder } from '$lib/hooks/queries/builder'
  import { postCreateEntity } from '$lib/hooks/actions/entity.action'
  import { snackbarStore } from '$lib/stores/snackbar'

  interface Props {
    modalId?: string
    closeModal?: () => void
    // Additional props
  }

  let { modalId = '', closeModal = () => {} }: Props = $props()

  // 1. Form state
  let fieldOne = $state('')
  let fieldTwo = $state('')
  let selectedOption = $state('')

  // 2. Mutation setup
  const createEntity = mutationBuilder(
    postCreateEntity,
    ['getEntityList'],
    [],
    {
      successMessage: '등록되었습니다.',
      errorMessage: '등록에 실패했습니다.'
    }
  )

  // 3. Form submission
  const handleConfirm = () => {
    // Client validation
    if (!fieldOne.trim()) {
      snackbarStore.error('필드를 입력해주세요.')
      return
    }

    createEntity.mutate({
      field_one: fieldOne,
      field_two: fieldTwo,
      option: selectedOption
    }, {
      onSuccess: () => closeModal()
    })
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
>
  {#snippet header()}
    <Typography variant="headline-02-semibold">엔티티 등록</Typography>
  {/snippet}

  {#snippet body()}
    <div class="flex flex-col gap-5 py-6">
      <!-- Field 1 -->
      <div class="flex flex-col gap-2">
        <Typography variant="body-01-medium" color="gray-500">필드 1</Typography>
        <input
          type="text"
          bind:value={fieldOne}
          placeholder="입력해주세요"
          class="h-13 w-full rounded-xl border border-gray-200 px-4
                 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
        />
      </div>

      <!-- Select field -->
      <div class="flex flex-col gap-2">
        <Typography variant="body-01-medium" color="gray-500">옵션</Typography>
        <Select
          options={['옵션1', '옵션2', '옵션3']}
          bind:selected={selectedOption}
          placeholder="선택해주세요"
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end gap-3">
      <Button color="light" onclick={closeModal}>취소</Button>
      <Button onclick={handleConfirm} loading={createEntity.isPending}>등록</Button>
    </div>
  {/snippet}
</BaseModal>
```

### Confirm Modal Usage

```typescript
import { modalStore } from '$lib/stores/modal'
import ConfirmModal from '$lib/components/modal/ConfirmModal.svelte'

const handleDelete = async () => {
  const confirmed = await modalStore.openWithPromise(
    ConfirmModal,
    {
      title: '삭제 확인',
      message: '정말 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소'
    },
    { size: 'sm' }
  )

  if (confirmed) {
    deleteMutation.mutate({ id: targetId })
  }
}
```

---

## Svelte 5 Patterns (Runes API)

### State Management

```typescript
// Local reactive state
let count = $state(0)
let items = $state<Item[]>([])
let user = $state<User | null>(null)

// Bindable props (two-way binding from parent)
let checked = $bindable(false)
let value = $bindable('')

// Derived values (computed)
let doubled = $derived(count * 2)
let filteredItems = $derived(items.filter(i => i.active))
let isValid = $derived(name.length > 0 && email.includes('@'))

// Side effects
$effect(() => {
  console.log('Count changed:', count)
  // Cleanup function (optional)
  return () => console.log('Cleanup')
})

// Effect that runs once on mount
$effect(() => {
  untrack(() => {
    // Initialize something
  })
})
```

### Props Pattern

```svelte
<script lang="ts">
  interface Props {
    title: string
    count?: number
    items?: Item[]
    class?: string  // For class passthrough
    onchange?: (value: string) => void
  }

  let {
    title,
    count = 0,
    items = [],
    class: className = '',
    onchange
  }: Props = $props()

  // Bindable props
  let selected = $bindable<string>('')
</script>
```

### Snippet Pattern (Svelte 5)

```svelte
<!-- Parent component -->
<Card>
  {#snippet header()}
    <h1>Title</h1>
  {/snippet}

  {#snippet body()}
    <p>Content</p>
  {/snippet}
</Card>

<!-- Card component -->
<script>
  import type { Snippet } from 'svelte'

  interface Props {
    header?: Snippet
    body?: Snippet
    children?: Snippet
  }

  let { header, body, children }: Props = $props()
</script>

<div class="card">
  {#if header}
    <div class="card-header">{@render header()}</div>
  {/if}
  {#if body}
    <div class="card-body">{@render body()}</div>
  {:else if children}
    {@render children()}
  {/if}
</div>
```

---

## Authentication & Authorization

### Overview
- JWT-based authentication with access/refresh tokens stored in HTTP-only cookies
- Role-based access control (RBAC) with three roles: `counselor`, `manager`, `super_admin`
- Permission system with granular permissions (view_assessment, manage_users, etc.)
- Protected routes use `(protected)` layout that enforces authentication
- Permission engine (`src/lib/utils/permission-engine.ts`) evaluates complex permission rules

### Layout System
- Main layout (`src/routes/+layout.svelte`) conditionally shows/hides header
- Assessment routes (like Rorschach) use full-screen layouts without header
- Protected routes require authentication via nested layout

### State Management
- Svelte stores for global state (auth, permissions)
- Derived stores for computed values (user roles, permission checks)
- Context-based permission evaluation system
- TanStack Query for server state (API data caching, mutations)

---

## Quick Reference: Adding New API Endpoints

### 1. Define Action
```typescript
// src/lib/hooks/actions/newEntity.action.ts
export const getNewEntityList = (): Action<NewEntityResponse> => ({
  key: ['newEntity'],
  request: (params) => appInstance.get('/new-entity', { params }).then(r => r.data)
});

export const createNewEntity = (): Action<NewEntityResponse> => ({
  key: ['createNewEntity'],
  request: (payload) => appInstance.post('/new-entity', payload).then(r => r.data)
});
```

### 2. Use in Component
```svelte
<script lang="ts">
import { queryBuilder, mutationBuilder } from '$lib/hooks/queries/builder';
import { getNewEntityList, createNewEntity } from '$lib/hooks/actions/newEntity.action';

const entityList = $derived(queryBuilder(getNewEntityList, { filter: 'active' }));
const createMutation = mutationBuilder(createNewEntity, ['newEntity'], [], {
  successMessage: '생성되었습니다.',
  errorMessage: '생성에 실패했습니다.'
});

$effect(() => {
  if (entityList.isSuccess) {
    console.log(entityList.data);
  }
});
</script>

{#if entityList.isPending}
  <Loading />
{:else if entityList.isError}
  <Error message={entityList.error.message} />
{:else}
  {#each entityList.data.data as item}
    <Item {item} />
  {/each}
{/if}
```

### 3. Error Handling Checklist
- [ ] Action defines appropriate query keys
- [ ] Mutation includes invalidation keys for related queries
- [ ] Success/error messages are user-friendly (Korean)
- [ ] Loading states handled in UI (`isPending`)
- [ ] Error states handled in UI (`isError`)
