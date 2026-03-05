<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  // Redirect to app on load — returning users go straight to their last project
  if (browser) {
    const lastSlug = localStorage.getItem('manifest_last_project');
    if (lastSlug) {
      goto(`/app/${lastSlug}`, { replaceState: true });
    } else {
      goto('/app', { replaceState: true });
    }
  }
</script>

<div
  style="display: flex; align-items: center; justify-content: center; height: 100vh;"
>
  <p>Redirecting to app...</p>
</div>
