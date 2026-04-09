<script lang="ts">
	import TreeMode from '$lib/components/TreeMode.svelte';
	import type { DesireCacheItem, DesireCachePayload } from '$lib/types/desire-cache';

	let { data } = $props<{
		data: {
			payload: DesireCachePayload | null;
			apiBaseUrl: string;
			apiItemsUrl: string;
			error: string | null;
		};
	}>();

	const payload = $derived(data.payload);
	const items = $derived<DesireCacheItem[]>(payload?.items ?? []);
	const sections = $derived(payload?.sections ?? []);
	const sectionOptions = $derived(['ALL', ...sections]);
	const hotCount = $derived(items.filter((item) => item.priority === 'HOT').length);
	const saleCount = $derived(items.filter((item) => item.sale || item.priority === 'SALE').length);
	const changedCount = $derived(items.filter((item) => item.priceChanged).length);
	let selectedSection = $state('ALL');
	let searchQuery = $state('');
	let selectedItemId = $state<string | null>(null);
	const normalizedQuery = $derived(searchQuery.trim().toLowerCase());
	const filteredItems = $derived(
		items.filter((item) => {
			if (selectedSection !== 'ALL' && item.section !== selectedSection) return false;
			if (!normalizedQuery) return true;

			const haystack = [
				item.title,
				item.section,
				item.subsection,
				item.source,
				item.description,
				item.fetchedDescription
			]
				.join(' ')
				.toLowerCase();

			return haystack.includes(normalizedQuery);
		})
	);
	const selectedItem = $derived(items.find((item) => item.id === selectedItemId) ?? null);

	function openDossier(item: DesireCacheItem) {
		selectedItemId = item.id;
	}

	function closeDossier() {
		selectedItemId = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeDossier();
	}

	function detailRows(item: DesireCacheItem) {
		return [
			['SECTION', item.section || 'UNSORTED'],
			['BRANCH', item.subsection || 'GENERAL'],
			['PRICE', item.effectivePrice || item.lastSeenPrice || 'UNKNOWN'],
			['SOURCE', item.source || 'UNKNOWN_SOURCE'],
			['LAST FETCH', item.lastFetchedAt || 'UNKNOWN'],
			['STATUS', item.hasMetadataError ? 'DEGRADED' : item.priceChanged ? 'PRICE_SHIFT' : 'SYNC_OK']
		];
	}

	function detailTags(item: DesireCacheItem) {
		return [
			item.priority,
			item.sale ? 'SALE' : '',
			item.amazon ? 'AMAZON' : '',
			item.size || '',
			item.priceChanged ? 'PRICE_SHIFT' : ''
		].filter(Boolean);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app-shell">
	<header class="hero-panel panel">
		<div class="hero-copy">
			<p class="eyebrow">DESIRE CACHE // SVELTEKIT STAGING</p>
			<h1>Acquire order from the archive, not another pile of divs.</h1>
			<p class="lede">
				Separate frontend scaffold for the Desire Cache replacement. Backend remains canonical at
				<code>/api/items</code>; Tree Mode is the first live migration target.
			</p>
		</div>

		<div class="hero-meta">
			<div class="meta-card">
				<span>API BASE</span>
				<strong>{data.apiBaseUrl || 'same-origin'}</strong>
			</div>
			<div class="meta-card">
				<span>ITEM FEED</span>
				<strong>{data.apiItemsUrl}</strong>
			</div>
			<div class="meta-card">
				<span>SYNC TIME</span>
				<strong>{payload?.generatedAt ?? 'unavailable'}</strong>
			</div>
		</div>
	</header>

	<section class="dashboard-grid">
		<div class="panel stat-card">
			<span>TOTAL OBJECTS</span>
			<strong>{items.length}</strong>
		</div>
		<div class="panel stat-card">
			<span>HOT</span>
			<strong>{hotCount}</strong>
		</div>
		<div class="panel stat-card">
			<span>SALE</span>
			<strong>{saleCount}</strong>
		</div>
		<div class="panel stat-card">
			<span>PRICE SHIFT</span>
			<strong>{changedCount}</strong>
		</div>
		<div class="panel stat-card wide">
			<span>SECTIONS</span>
			<strong>{sections.join(' // ') || 'none loaded'}</strong>
		</div>
	</section>

	<section class="panel mode-shell">
		<div class="mode-header">
			<div>
				<p class="eyebrow">MODE 01</p>
				<h2>Tree Mode</h2>
			</div>
			<p class="mode-note">
				First-pass replacement for the current accordion/grid frontend. Map Mode remains a later phase.
			</p>
		</div>

		{#if data.error}
			<div class="empty-state">
				<strong>Feed unavailable.</strong>
				<p>{data.error}</p>
				<p>Set <code>PUBLIC_DESIRE_CACHE_API_BASE_URL</code> if the API is not same-origin.</p>
			</div>
		{:else if !payload}
			<div class="empty-state">
				<strong>No payload loaded.</strong>
			</div>
		{:else if !items.length}
			<div class="empty-state">
				<strong>Zero items returned.</strong>
				<p>The connection is working, but the canonical feed is empty.</p>
			</div>
		{:else}
			<div class="controls-panel">
				<label class="control-field">
					<span>SECTION FILTER</span>
					<select bind:value={selectedSection}>
						{#each sectionOptions as option}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</label>

				<label class="control-field search-field">
					<span>SEARCH</span>
					<input
						bind:value={searchQuery}
						type="search"
						placeholder="title, branch, source, dossier text"
					/>
				</label>

				<div class="control-field readout">
					<span>VISIBLE</span>
					<strong>{filteredItems.length} / {items.length}</strong>
				</div>
			</div>

			{#if filteredItems.length}
				<TreeMode items={filteredItems} onOpenItem={openDossier} />
			{:else}
				<div class="empty-state">
					<strong>No objects match the current controls.</strong>
					<p>Adjust the section filter or broaden the search query.</p>
				</div>
			{/if}
		{/if}
	</section>
</div>

{#if selectedItem}
	<div class="modal-backdrop" role="presentation" onmousedown={closeDossier}>
		<div
			class="modal-panel"
			role="dialog"
			aria-modal="true"
			aria-label="Desire Cache dossier"
			tabindex="-1"
			onmousedown={(event) => event.stopPropagation()}
		>
			<div class="modal-header">
				<div>
					<p class="eyebrow">DOSSIER // {selectedItem.section} // {selectedItem.subsection}</p>
					<h3>{selectedItem.title}</h3>
				</div>
				<button class="ghost-button" type="button" onclick={closeDossier}>CLOSE</button>
			</div>

			<div class="modal-grid">
				<div class="modal-visual">
					{#if selectedItem.image}
						<img src={selectedItem.image} alt={selectedItem.title} />
					{:else}
						<div class="image-fallback">NO PREVIEW AVAILABLE</div>
					{/if}
				</div>

				<div class="modal-copy">
					<p class="modal-description">
						{selectedItem.description || selectedItem.fetchedDescription || 'No dossier text cached yet.'}
					</p>

					<div class="modal-tags">
						{#each detailTags(selectedItem) as tag}
							<span>{tag}</span>
						{/each}
					</div>

					<div class="modal-meta">
						{#each detailRows(selectedItem) as [label, value]}
							<div class="meta-row">
								<span>{label}</span>
								<strong>{value}</strong>
							</div>
						{/each}
					</div>

					<div class="modal-actions">
						<a class="primary-button" href={selectedItem.url} target="_blank" rel="noreferrer">
							OPEN SOURCE LINK
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
