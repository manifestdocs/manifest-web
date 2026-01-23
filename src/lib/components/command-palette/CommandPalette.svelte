<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { api } from '$lib/api/client.js';
	import { goto } from '$app/navigation';
	import type { components } from '$lib/api/schema.js';
	import { StateIcon } from '$lib/components/icons/index.js';

	type FeatureSummary = components['schemas']['FeatureSummary'];
	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		projectId: string;
		projectSlug: string;
		featureTree?: FeatureTreeNode[];
	}

	let { open, onOpenChange, projectId, projectSlug, featureTree = [] }: Props = $props();

	let query = $state('');
	let results = $state<FeatureSummary[]>([]);
	let isLoading = $state(false);
	let selectedIndex = $state(0);
	let inputRef = $state<HTMLInputElement | null>(null);

	// Build a map of feature ID to parent path (breadcrumbs)
	const featurePathMap = $derived.by(() => {
		const map = new Map<string, string[]>();

		function buildPaths(nodes: FeatureTreeNode[], path: string[] = []) {
			for (const node of nodes) {
				map.set(node.id, path);
				buildPaths(node.children, [...path, node.title]);
			}
		}

		buildPaths(featureTree);
		return map;
	});

	// Results with breadcrumb paths attached
	type ResultWithPath = FeatureSummary & { breadcrumbs: string[] };
	const resultsWithPaths = $derived<ResultWithPath[]>(
		results.map((result) => ({
			...result,
			breadcrumbs: featurePathMap.get(result.id) || []
		}))
	);

	let searchTimeout: ReturnType<typeof setTimeout> | null = null;
	const DEBOUNCE_MS = 200;

	async function handleSearch(searchQuery: string) {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		if (!searchQuery.trim()) {
			results = [];
			isLoading = false;
			return;
		}

		isLoading = true;

		searchTimeout = setTimeout(async () => {
			const { data, error } = await api.GET('/features/search', {
				params: {
					query: {
						q: searchQuery,
						project_id: projectId,
						limit: 20
					}
				}
			});

			if (!error && data) {
				results = data;
				selectedIndex = 0;
			}
			isLoading = false;
		}, DEBOUNCE_MS);
	}

	$effect(() => {
		handleSearch(query);
	});

	// Reset state when dialog opens
	$effect(() => {
		if (open) {
			query = '';
			results = [];
			selectedIndex = 0;
			// Focus input after dialog animation
			setTimeout(() => inputRef?.focus(), 50);
		}
	});

	function navigateToFeature(featureId: string) {
		goto(`/app/${projectSlug}?feature=${featureId}`);
		onOpenChange(false);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (resultsWithPaths.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = (selectedIndex + 1) % resultsWithPaths.length;
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = (selectedIndex - 1 + resultsWithPaths.length) % resultsWithPaths.length;
				break;
			case 'Enter':
				e.preventDefault();
				const selected = resultsWithPaths[selectedIndex];
				if (selected) {
					navigateToFeature(selected.id);
				}
				break;
		}
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="palette-overlay" />
		<Dialog.Content class="palette-content" onkeydown={handleKeydown}>
			<Dialog.Title class="sr-only">Search Features</Dialog.Title>
			<Dialog.Description class="sr-only">
				Type to search features in this project. Use arrow keys to navigate, Enter to select,
				Escape to close.
			</Dialog.Description>

			<div class="palette-input-wrapper">
				<input
					bind:this={inputRef}
					type="text"
					class="palette-input"
					placeholder="Search features..."
					bind:value={query}
					aria-label="Search features"
				/>
			</div>

			<div class="palette-results">
				{#if isLoading}
					<div class="palette-empty">Searching...</div>
				{:else if query.trim() && resultsWithPaths.length === 0}
					<div class="palette-empty">No features found matching "{query}"</div>
				{:else if !query.trim()}
					<div class="palette-empty">Type to search features</div>
				{:else}
					{#each resultsWithPaths as result, index (result.id)}
						<button
							class="palette-item"
							class:selected={index === selectedIndex}
							onclick={() => navigateToFeature(result.id)}
							onmouseenter={() => (selectedIndex = index)}
						>
							<StateIcon state={result.state} size={14} />
							<div class="item-content">
								<div class="item-title">{result.title}</div>
								{#if result.breadcrumbs.length > 0}
									<div class="item-breadcrumbs">
										{result.breadcrumbs.join(' / ')}
									</div>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.palette-overlay) {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(0, 0, 0, 0.5);
		animation: fadeIn 0.15s ease;
	}

	:global(.palette-content) {
		position: fixed;
		top: 20%;
		left: 50%;
		transform: translateX(-50%);
		z-index: 51;
		width: 100%;
		max-width: 560px;
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		animation: slideIn 0.15s ease;
		overflow: hidden;
	}

	.palette-input-wrapper {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-default);
	}

	.palette-input {
		width: 100%;
		padding: 8px 0;
		font-size: 15px;
		background: transparent;
		border: none;
		color: var(--foreground);
		outline: none;
	}

	.palette-input::placeholder {
		color: var(--foreground-muted);
	}

	.palette-results {
		max-height: 320px;
		overflow-y: auto;
		padding: 8px;
	}

	.palette-empty {
		padding: 24px 16px;
		text-align: center;
		font-size: 13px;
		color: var(--foreground-muted);
	}

	.palette-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		width: 100%;
		padding: 10px 12px;
		background: transparent;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		color: var(--foreground);
		transition: background 0.1s ease;
	}

	.palette-item:hover,
	.palette-item.selected {
		background: var(--background-muted);
	}

	.item-content {
		flex: 1;
		min-width: 0;
	}

	.item-title {
		font-size: 14px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-breadcrumbs {
		margin-top: 2px;
		font-size: 12px;
		color: var(--foreground-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>
