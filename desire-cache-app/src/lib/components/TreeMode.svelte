<script lang="ts">
	import type { Node, Edge } from '@xyflow/svelte';
	import { SvelteFlow, Background, Controls, MarkerType } from '@xyflow/svelte';
	import type { DesireCacheItem } from '$lib/types/desire-cache';

	let { items, onOpenItem } = $props<{
		items: DesireCacheItem[];
		onOpenItem?: (item: DesireCacheItem) => void;
	}>();

	type ThemeSection = {
		raw: string;
		label: string;
		icon: string;
		color: string;
		description: string;
	};

	type ItemNodeData = {
		kind: 'item';
		item: DesireCacheItem;
		section: ThemeSection;
		branch: string;
		source: string;
		state: 'hot' | 'sale' | 'changed' | 'normal';
	};

	type HubNodeData = {
		kind: 'hub';
		section: ThemeSection;
		count: number;
	};

	type BranchNodeData = {
		kind: 'branch';
		section: ThemeSection;
		label: string;
		count: number;
	};

	type GraphNodeData = ItemNodeData | HubNodeData | BranchNodeData;

	const weakBranchLabels = new Set(['', 'GENERAL', 'MISC', 'OTHER', 'STUFF', 'ITEMS']);

	const sectionThemes: Record<string, ThemeSection> = {
		ABILITY_POINT_ADDITIONS: {
			raw: 'ABILITY_POINT_ADDITIONS',
			label: 'Perk Injector',
			icon: 'PI',
			color: '#6af1ff',
			description: 'Unlocks, augmentations, and capability grafts'
		},
		COMFORT_STATUS_UPGRADES: {
			raw: 'COMFORT_STATUS_UPGRADES',
			label: 'Comfort Daemon',
			icon: 'CD',
			color: '#97ffcb',
			description: 'Home comfort and quality-of-life mods'
		},
		BIOMECHANICAL_SHELL: {
			raw: 'BIOMECHANICAL_SHELL',
			label: 'Shell Mods',
			icon: 'SM',
			color: '#ff6ba8',
			description: 'Wearable shell and body-facing gear'
		},
		HARDWARE_MATRIX: {
			raw: 'HARDWARE_MATRIX',
			label: 'Rig Matrix',
			icon: 'RM',
			color: '#ffd37f',
			description: 'Desk, network, and hardware infrastructure'
		}
	};

	function humanizeLabel(label: string) {
		return label
			.replace(/[_-]+/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (match) => match.toUpperCase());
	}

	function hostnameLabel(url: string) {
		try {
			const hostname = new URL(url).hostname.replace(/^www\./, '');
			const base = hostname.split('.').slice(0, -1).join(' ') || hostname;
			return humanizeLabel(base);
		} catch {
			return 'Unknown Source';
		}
	}

	function sourceLabel(item: DesireCacheItem) {
		if (item.source?.trim()) return humanizeLabel(item.source.trim());
		return hostnameLabel(item.url);
	}

	function deriveBranchLabel(item: DesireCacheItem) {
		const subsection = (item.subsection || '').trim().toUpperCase();
		if (!weakBranchLabels.has(subsection)) return humanizeLabel(item.subsection || 'General');
		return sourceLabel(item);
	}

	function sectionTheme(rawName: string): ThemeSection {
		return (
			sectionThemes[rawName] ?? {
				raw: rawName,
				label: humanizeLabel(rawName),
				icon: '??',
				color: '#6af1ff',
				description: 'Archive sector'
			}
		);
	}

	function itemState(item: DesireCacheItem): ItemNodeData['state'] {
		if (item.priority === 'HOT') return 'hot';
		if (item.sale || item.priority === 'SALE') return 'sale';
		if (item.priceChanged) return 'changed';
		return 'normal';
	}

	const graph = $derived.by(() => {
		const grouped = new Map<string, Map<string, DesireCacheItem[]>>();

		for (const item of items) {
			const sectionName = item.section || 'UNSORTED';
			if (!grouped.has(sectionName)) grouped.set(sectionName, new Map());
			const branches = grouped.get(sectionName)!;
			const branchLabel = deriveBranchLabel(item);
			if (!branches.has(branchLabel)) branches.set(branchLabel, []);
			branches.get(branchLabel)!.push(item);
		}

		const nodes: Node<GraphNodeData>[] = [];
		const edges: Edge[] = [];
		const sections = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
		const sectionGap = 560;
		const branchGap = 260;
		const itemGap = 158;
		const centerX = 280;
		const centerY = 320;

		sections.forEach(([rawName, branchMap], sectionIndex) => {
			const theme = sectionTheme(rawName);
			const angle = (-Math.PI / 2) + (sectionIndex / Math.max(sections.length, 1)) * Math.PI * 2;
			const sectionX = centerX + Math.cos(angle) * sectionGap;
			const sectionY = centerY + Math.sin(angle) * sectionGap * 0.68;
			const hubId = `hub:${rawName}`;
			const branches = Array.from(branchMap.entries()).sort(([a], [b]) => a.localeCompare(b));

			nodes.push({
				id: hubId,
				position: { x: sectionX, y: sectionY },
				data: { kind: 'hub', section: theme, count: branches.reduce((sum, [, list]) => sum + list.length, 0) },
				type: 'default'
			});

			branches.forEach(([branchLabel, branchItems], branchIndex) => {
				const arcBase = branchIndex - (branches.length - 1) / 2;
				const branchX = sectionX + 180 + Math.cos(angle) * 110 + arcBase * 44;
				const branchY = sectionY + arcBase * branchGap * 0.68 + Math.sin(angle) * 86;
				const branchId = `branch:${rawName}:${branchLabel}`;

				nodes.push({
					id: branchId,
					position: { x: branchX, y: branchY },
					data: { kind: 'branch', section: theme, label: branchLabel, count: branchItems.length },
					type: 'default'
				});

				edges.push({
					id: `edge:${hubId}:${branchId}`,
					source: hubId,
					target: branchId,
					type: 'smoothstep',
					markerEnd: { type: MarkerType.ArrowClosed, color: theme.color },
					style: `stroke:${theme.color};stroke-opacity:0.55;stroke-width:2.2`
				});

				branchItems.forEach((item, itemIndex) => {
					const itemId = `item:${item.id}`;
					const fanOffset = itemIndex - (branchItems.length - 1) / 2;
					const itemX = branchX + 220 + (itemIndex % 2) * 36;
					const itemY = branchY + fanOffset * itemGap * 0.72;

					nodes.push({
						id: itemId,
						position: { x: itemX, y: itemY },
						data: {
							kind: 'item',
							item,
							section: theme,
							branch: branchLabel,
							source: sourceLabel(item),
							state: itemState(item)
						},
						type: 'default'
					});

					edges.push({
						id: `edge:${branchId}:${itemId}`,
						source: branchId,
						target: itemId,
						type: 'smoothstep',
						markerEnd: { type: MarkerType.ArrowClosed, color: theme.color },
						style: `stroke:${theme.color};stroke-opacity:0.34;stroke-width:1.8`
					});
				});
			});
		});

		return { nodes, edges };
	});

	const itemNodes = $derived(graph.nodes.filter((node): node is Node<ItemNodeData> => node.data.kind === 'item'));
	const hubNodes = $derived(graph.nodes.filter((node): node is Node<HubNodeData> => node.data.kind === 'hub'));
	const branchNodes = $derived(graph.nodes.filter((node): node is Node<BranchNodeData> => node.data.kind === 'branch'));

	let selectedId = $state<string | null>(null);
	let brokenImages = $state<Record<string, true>>({});

	const selectedNode = $derived(itemNodes.find((node) => node.id === selectedId));
	const selectedItem = $derived(selectedNode?.data.item ?? null);

	function markBroken(itemId: string) {
		brokenImages = { ...brokenImages, [itemId]: true };
	}

	function hasImage(item: DesireCacheItem) {
		return Boolean(item.image) && !brokenImages[item.id];
	}

	function tokenInitials(label: string) {
		return label
			.split(' ')
			.slice(0, 2)
			.map((part) => part[0] ?? '')
			.join('')
			.toUpperCase();
	}

	function handleNodeClick({ node }: { node: Node<GraphNodeData>; event: MouseEvent | TouchEvent }) {
		if (node.data.kind === 'item') {
			selectedId = selectedId === node.id ? null : node.id;
		}
	}

	function shortTitle(title: string) {
		return title.length <= 34 ? title : `${title.slice(0, 31)}...`;
	}

	function itemTags(item: DesireCacheItem) {
		return [item.priority, item.sale ? 'SALE' : '', item.amazon ? 'AMAZON' : '', item.size].filter(Boolean);
	}
</script>

<div class="tree-board flow-board react-flow-board">
	<section class="topology-shell flow-shell">
		<header class="topology-header">
			<div>
				<p class="section-kicker">TREE MODE // GRAPH-NATIVE PROTOTYPE</p>
				<h3>Video-game browsing field</h3>
			</div>
			<div class="section-readout">
				<span>{items.length} items live</span>
				<span>{itemNodes.length} item nodes</span>
				<span>Pan, zoom, hover, tap</span>
			</div>
		</header>

		<div class="interaction-guide">
			<p>This is the pivot away from box logic. Pan the board, zoom the field, hover or tap nodes for detail, and follow the branches like a game-space instead of a dashboard.</p>
		</div>

		<div class="graph-flow-layout">
			<div class="graph-stage">
				<SvelteFlow
					nodes={graph.nodes}
					edges={graph.edges}
					fitView
					fitViewOptions={{ padding: 0.18 }}
					minZoom={0.32}
					maxZoom={1.5}
					onnodeclick={handleNodeClick}
				>
					<Background gap={32} />
					<Controls />
				</SvelteFlow>

				<div class="graph-node-overlay">
					{#each hubNodes as node (node.id)}
						<button
							class="overlay-node overlay-hub"
							style={`left:${node.position.x}px; top:${node.position.y}px; --node-color:${node.data.section.color};`}
							type="button"
						>
							<span class="overlay-hub-ring">{node.data.section.icon}</span>
							<span class="overlay-hub-copy">
								<strong>{node.data.section.label}</strong>
								<small>{node.data.count} items</small>
							</span>
						</button>
					{/each}

					{#each branchNodes as node (node.id)}
						<button
							class="overlay-node overlay-branch"
							style={`left:${node.position.x}px; top:${node.position.y}px; --node-color:${node.data.section.color};`}
							type="button"
						>
							<strong>{node.data.label}</strong>
							<small>{node.data.count}</small>
						</button>
					{/each}

					{#each itemNodes as node (node.id)}
						<button
							class:selected={selectedId === node.id}
							class={`overlay-node overlay-item ${node.data.state}`}
							style={`left:${node.position.x}px; top:${node.position.y}px; --node-color:${node.data.section.color};`}
							type="button"
							onclick={() => (selectedId = selectedId === node.id ? null : node.id)}
						>
							<span class="overlay-item-core">
								{#if hasImage(node.data.item)}
									<img src={node.data.item.image} alt={node.data.item.title} loading="lazy" onerror={() => markBroken(node.data.item.id)} />
								{:else}
									<span class="overlay-fallback">{tokenInitials(node.data.source)}</span>
								{/if}
							</span>
							<span class="overlay-item-copy">
								<strong>{shortTitle(node.data.item.title)}</strong>
								<small>{node.data.source}</small>
							</span>
						</button>
					{/each}
				</div>
			</div>

			{#if selectedItem}
				<aside class="detail-dock floating-detail side-detail">
					<div class="detail-visual">
						{#if hasImage(selectedItem)}
							<img src={selectedItem.image} alt={selectedItem.title} loading="lazy" onerror={() => markBroken(selectedItem.id)} />
						{:else}
							<div class="node-image-fallback detail-fallback">
								<span>Selected Node</span>
								<strong>{sourceLabel(selectedItem)}</strong>
							</div>
						{/if}
					</div>

					<div class="detail-copy">
						<p class="section-kicker">NODE DOSSIER // {sourceLabel(selectedItem)}</p>
						<h4>{selectedItem.title}</h4>
						<p class="detail-description">{selectedItem.description || selectedItem.fetchedDescription || 'No blurb cached yet.'}</p>
						<div class="tree-node-tags">
							{#each itemTags(selectedItem) as tag}
								<span>{tag}</span>
							{/each}
						</div>
						<div class="tree-node-meta-row">
							<span>{selectedItem.effectivePrice || selectedItem.lastSeenPrice || 'UNKNOWN'}</span>
							<span>{selectedItem.priceChanged ? 'PRICE SHIFT' : 'SYNC_OK'}</span>
						</div>
						<div class="tree-node-actions">
							<button class="dossier-button" type="button" onclick={() => onOpenItem?.(selectedItem)}>DOSSIER</button>
							<a href={selectedItem.url} target="_blank" rel="noreferrer">OPEN LINK</a>
						</div>
					</div>
				</aside>
			{/if}
		</div>
	</section>
</div>
