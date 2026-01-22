<script lang="ts">
	import { SignUp } from 'svelte-clerk';
</script>

<div class="auth-container">
	<SignUp
		routing="path"
		path="/sign-up"
		signInUrl="/sign-in"
		fallbackRedirectUrl="/app"
	/>
</div>

<style>
	.auth-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		background: var(--background);
	}
</style>
