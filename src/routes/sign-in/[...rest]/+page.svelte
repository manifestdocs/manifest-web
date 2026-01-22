<script lang="ts">
	import { SignIn } from 'svelte-clerk';
</script>

<div class="auth-container">
	<SignIn
		routing="path"
		path="/sign-in"
		signUpUrl="/sign-up"
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
