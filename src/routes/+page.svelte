<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  // Redirect to app on load
  if (browser) {
    goto('/app', { replaceState: true });
  }
</script>

<div
  style="display: flex; align-items: center; justify-content: center; height: 100vh;"
>
  <p>Redirecting to app...</p>
</div>
