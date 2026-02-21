# SAKU Frontend Integration Guide (SvelteKit)

This guide provides examples and best practices for integrating a Svelte/SvelteKit application with the SAKU Backend API.

## 1. Environment Setup

Store the API URL in your frontend's environment variables:

```env
# .env
PUBLIC_API_URL=http://localhost:8787
```

## 2. API Client Setup (Axios)

Using Axios is recommended because you can configure interceptors to inject the `Authorization` token automatically into every request made from the client side.

Install axios: `npm install axios`

```typescript
// src/lib/api.ts
import axios from "axios";
import { env } from "$env/dynamic/public";
import { goto } from "$app/navigation";

export const api = axios.create({
  baseURL: env.PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to inject Token
api.interceptors.request.use((config) => {
  // Check if we are in the browser
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("saku_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor to handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("saku_token");
      localStorage.removeItem("saku_user");
      goto("/login");
    }
    return Promise.reject(error.response?.data || error);
  },
);
```

---

## 3. Standard API Response Interface

All SAKU endpoints wrap their responses in a standard JSON format.

```typescript
// src/lib/types.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  meta: {
    next_cursor: string | null;
    has_more: boolean;
  };
}
```

---

## 4. Authentication Flow

### A. Standard Login

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  let email = '';
  let password = '';
  let errorMessage = '';

  async function handleLogin() {
    try {
      const res = await api.post('/auth/login', { email, password });

      // Save Token and User
      localStorage.setItem('saku_token', res.data.token);
      localStorage.setItem('saku_user', JSON.stringify(res.data.user));

      goto('/dashboard');
    } catch (err: any) {
      errorMessage = err.message || "Failed to login";
    }
  }
</script>

<form on:submit|preventDefault={handleLogin}>
  <input type="email" bind:value={email} placeholder="Email" required />
  <input type="password" bind:value={password} placeholder="Password" required />
  <button type="submit">Login</button>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
</form>
```

### B. OAuth Flow (Google & GitHub)

For OAuth, redirect the browser window directly to the API endpoint.

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { env } from '$env/dynamic/public';

  function loginWithGoogle() {
    window.location.href = `${env.PUBLIC_API_URL}/auth/google`;
  }
</script>

<button on:click={loginWithGoogle}>Login with Google</button>
```

When Google succeeds, Backend redirects to: `http://localhost:5173/oauth/success?token=SESSION_TOKEN`

```svelte
<!-- src/routes/oauth/success/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  onMount(() => {
    const token = $page.url.searchParams.get('token');

    if (token) {
      localStorage.setItem('saku_token', token);
      // Optional: Fetch user profile here and save to localStorage
      goto('/dashboard');
    } else {
      alert("Login failed");
      goto('/login');
    }
  });
</script>

<p>Logging you in...</p>
```

---

## 5. Fetching Data Example (Transactions)

Because of the Axios interceptor, you do not need to manually attach the token.

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  import { api } from '$lib/api';
  import type { PaginatedResponse } from '$lib/types';
  import { onMount } from 'svelte';

  let transactions: any[] = [];
  let loading = true;

  onMount(async () => {
    try {
      const res: PaginatedResponse = await api.get('/transactions');
      transactions = res.data || [];
    } catch (err) {
      console.error("Failed to fetch transactions", err);
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <p>Loading...</p>
{:else}
  <ul>
    {#each transactions as txn (txn.id)}
      <li>{txn.note || 'Transaction'} - {txn.amount}</li>
    {/each}
  </ul>
{/if}
```

---

## 6. Calling Cloudflare AI Insights

```svelte
<!-- src/routes/dashboard/Insights.svelte -->
<script lang="ts">
  import { api } from '$lib/api';
  import { onMount } from 'svelte';

  let insightMessage = '';
  let error = '';

  onMount(async () => {
    try {
      const date = new Date();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const res = await api.get(`/insights/monthly?month=${month}&year=${year}`);

      if (res.success) {
        insightMessage = res.data.insight;
      }
    } catch (err: any) {
      error = err.message || "Failed to load AI Insights.";
    }
  });
</script>

<div class="insight-box">
  <h3>Monthly Financial Insight</h3>
  {#if error}
    <p class="error">{error}</p>
  {:else if insightMessage}
    <p>{insightMessage}</p>
  {:else}
    <p>Analyzing financials...</p>
  {/if}
</div>
```

---

## 7. Uploading Receipts (Form Data)

To upload files like receipts, you must use JS `FormData` and pass it to API.

```svelte
<!-- src/components/UploadReceipt.svelte -->
<script lang="ts">
  import { api } from '$lib/api';

  export let transactionId: string;
  let fileList: FileList;

  async function handleUpload() {
    if (!fileList || fileList.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('receipt', fileList[0]);

      const res = await api.post(`/transactions/${transactionId}/receipt`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert('Receipt uploaded successfully!');
    } catch (err: any) {
      alert(err.message || "Failed to upload file");
    }
  }
</script>

<input type="file" bind:files={fileList} accept="image/*,application/pdf" />
<button on:click={handleUpload}>Upload</button>
```

---

## 8. Displaying Private Images (Receipts)

Because the R2 bucket is private, you cannot put the backend API URL directly into an `<img src="...">` tag without credentials. The browser does not attach local storage Auth headers to direct image sources. You must fetch it manually through SAKU backend.

```svelte
<!-- src/components/AuthorizedImage.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';

  export let transactionId: string;
  let imgUrl = '';
  let error = false;

  onMount(async () => {
    const token = localStorage.getItem('saku_token');

    try {
      const response = await fetch(`${env.PUBLIC_API_URL}/transactions/${transactionId}/receipt`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        error = true;
        return;
      }

      const blob = await response.blob();
      imgUrl = URL.createObjectURL(blob);
    } catch (e) {
      error = true;
    }
  });
</script>

{#if error}
  <p>Failed to load image.</p>
{:else if imgUrl}
  <img src={imgUrl} alt="Transaction Receipt" />
{:else}
  <p>Loading image...</p>
{/if}
```
