import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { buildApiUrl } from './config';
import type { DesireCacheItem, DesireCachePayload, SkillTreeNodeData } from './types';

const SECTION_ALIASES: Record<string, string> = {
  perks: 'Perk Injector',
  comfort: 'Comfort Daemon',
  style: 'Shell Mods',
  setup: 'Rig Matrix'
};

const SECTION_COLORS = ['#7dd3fc', '#c084fc', '#fb7185', '#4ade80', '#f59e0b', '#2dd4bf'];
const DEFAULT_NODE_COLOR = '#7dd3fc';

function sectionLabelFor(section: string) {
  return SECTION_ALIASES[section.toLowerCase()] ?? section;
}

function branchLabelFor(item: DesireCacheItem) {
  const subsection = item.subsection?.trim();
  if (subsection) return subsection;

  const source = item.source?.trim();
  if (source) return source;

  return 'Unsorted Branch';
}

function itemTitle(item: DesireCacheItem) {
  return item.titleOverride?.trim() || item.title?.trim() || item.fetchedTitle?.trim() || 'Unknown node';
}

function itemDescription(item: DesireCacheItem) {
  return item.description?.trim() || item.fetchedDescription?.trim() || 'No dossier text yet.';
}

function itemPrice(item: DesireCacheItem) {
  return item.effectivePrice || item.manualPrice || item.lastSeenPrice || 'Unknown';
}

function itemTypeLabel(item: DesireCacheItem) {
  if (item.status === 'section') return 'section';
  if (item.status === 'branch') return 'branch';
  if (item.priority?.trim()) return item.priority;
  return item.amazon ? 'amazon' : 'node';
}

function NodeCard({ data, selected }: NodeProps<Node<SkillTreeNodeData>>) {
  const item = data.item as DesireCacheItem;
  const title = itemTitle(item);
  const type = item.status || 'item';
  const nodeColor = (data.nodeColor as string) || DEFAULT_NODE_COLOR;
  const nodeClass = `skill-node skill-node--${type}${selected ? ' is-selected' : ''}`;

  return (
    <article className={nodeClass} style={{ ['--node-color' as string]: nodeColor }}>
      <div className="skill-node__glow" />
      <div className="skill-node__chrome" />
      <div className="skill-node__content">
        <p className="skill-node__type">{itemTypeLabel(item)}</p>
        <h3>{title}</h3>
        {type === 'item' ? (
          <>
            <p className="skill-node__meta">{data.branchLabel as string}</p>
            <div className="skill-node__footer">
              <span>{itemPrice(item)}</span>
              <span>{item.image ? 'image' : 'fallback'}</span>
            </div>
          </>
        ) : (
          <p className="skill-node__meta">{item.description}</p>
        )}
      </div>
    </article>
  );
}

const nodeTypes = {
  skill: NodeCard
};

function buildGraph(items: DesireCacheItem[]) {
  const nodes: Node<SkillTreeNodeData>[] = [];
  const edges: Edge[] = [];

  const sectionMap = new Map<string, Map<string, DesireCacheItem[]>>();

  for (const item of items) {
    const section = item.section?.trim() || 'Misc';
    const branch = branchLabelFor(item);

    if (!sectionMap.has(section)) sectionMap.set(section, new Map());
    const branchMap = sectionMap.get(section)!;
    if (!branchMap.has(branch)) branchMap.set(branch, []);
    branchMap.get(branch)!.push(item);
  }

  Array.from(sectionMap.entries()).forEach(([section, branches], sectionIndex) => {
    const color = SECTION_COLORS[sectionIndex % SECTION_COLORS.length];
    const sectionId = `section:${section}`;
    const sectionX = sectionIndex * 560;
    const sectionY = 120 + (sectionIndex % 2) * 160;

    nodes.push({
      id: sectionId,
      type: 'skill',
      position: { x: sectionX, y: sectionY },
      data: {
        item: {
          id: sectionId,
          url: '',
          title: sectionLabelFor(section),
          titleOverride: '',
          fetchedTitle: '',
          description: `${branches.size} branch lanes online`,
          fetchedDescription: '',
          image: '',
          section,
          subsection: '',
          priority: '',
          size: '',
          manualPrice: '',
          lastSeenPrice: '',
          effectivePrice: '',
          sale: false,
          saleOverride: false,
          amazon: false,
          source: '',
          status: 'section',
          hasMetadataError: false,
          metadataError: '',
          lastFetchedAt: ''
        },
        branchLabel: '',
        sectionLabel: sectionLabelFor(section),
        nodeColor: color
      },
      draggable: false
    });

    Array.from(branches.entries()).forEach(([branch, branchItems], branchIndex) => {
      const branchId = `branch:${section}:${branch}`;
      const branchColumn = branchIndex % 2;
      const branchRow = Math.floor(branchIndex / 2);
      const branchX = sectionX + 220 + branchColumn * 220;
      const branchY = sectionY + 170 + branchRow * 260 + branchColumn * 36;

      nodes.push({
        id: branchId,
        type: 'skill',
        position: { x: branchX, y: branchY },
        data: {
          item: {
            id: branchId,
            url: '',
            title: branch,
            titleOverride: '',
            fetchedTitle: '',
            description: `${branchItems.length} live nodes`,
            fetchedDescription: '',
            image: '',
            section,
            subsection: branch,
            priority: '',
            size: '',
            manualPrice: '',
            lastSeenPrice: '',
            effectivePrice: '',
            sale: false,
            saleOverride: false,
            amazon: false,
            source: '',
            status: 'branch',
            hasMetadataError: false,
            metadataError: '',
            lastFetchedAt: ''
          },
          branchLabel: branch,
          sectionLabel: sectionLabelFor(section),
          nodeColor: color
        },
        draggable: false
      });

      edges.push({
        id: `edge:${sectionId}:${branchId}`,
        source: sectionId,
        target: branchId,
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 2.4, opacity: 0.72 }
      });

      branchItems.forEach((item, itemIndex) => {
        const nodeId = `item:${item.id}`;
        const itemColumn = itemIndex % 3;
        const itemRow = Math.floor(itemIndex / 3);
        const nodeX = branchX + 210 + itemColumn * 170 + itemRow * 12;
        const nodeY = branchY + itemRow * 148 + (itemColumn - 1) * 22;

        nodes.push({
          id: nodeId,
          type: 'skill',
          position: { x: nodeX, y: nodeY },
          data: {
            item,
            branchLabel: branch,
            sectionLabel: sectionLabelFor(section),
            nodeColor: color
          },
          draggable: false
        });

        edges.push({
          id: `edge:${branchId}:${nodeId}`,
          source: branchId,
          target: nodeId,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: { stroke: color, strokeWidth: 1.65, opacity: 0.48 }
        });
      });
    });
  });

  return { nodes, edges };
}

function App() {
  const [payload, setPayload] = useState<DesireCachePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DesireCacheItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(buildApiUrl('/api/items'), { signal: controller.signal });
        if (!response.ok) throw new Error(`API request failed with ${response.status}`);
        const nextPayload = (await response.json()) as DesireCachePayload;
        setPayload(nextPayload);
        setSelectedItem(nextPayload.items[0] ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unknown Desire Cache API failure');
      }
    }

    load();
    return () => controller.abort();
  }, []);

  const graph = useMemo(() => buildGraph(payload?.items ?? []), [payload]);

  return (
    <ReactFlowProvider>
      <main className="app-shell">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Desire Cache React Pivot</p>
            <h1>Graph-native shop lattice</h1>
            <p className="lede">
              Compact nodes first, dossier on focus, and branch lanes that feel closer to a game perk board than a boxed dashboard.
            </p>
          </div>
          <div className="stats-strip">
            <span>{payload?.totalItems ?? 0} nodes</span>
            <span>{payload?.sections.length ?? 0} sectors</span>
            <span>{error ? 'feed degraded' : 'feed nominal'}</span>
          </div>
        </section>

        <section className="workspace-panel">
          <div className="flow-panel">
            {error ? (
              <div className="state-panel error">{error}</div>
            ) : (
              <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.16 }}
                onNodeClick={(_, node) => setSelectedItem(node.data.item as DesireCacheItem)}
                onNodeMouseEnter={(_, node) => {
                  if ((node.data.item as DesireCacheItem).status === 'item') {
                    setSelectedItem(node.data.item as DesireCacheItem);
                  }
                }}
                minZoom={0.3}
                maxZoom={1.6}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                proOptions={{ hideAttribution: true }}
              >
                <MiniMap pannable zoomable nodeColor={(node) => String(node.data?.nodeColor ?? DEFAULT_NODE_COLOR)} />
                <Controls />
                <Background color="#15203a" gap={28} size={1.2} />
              </ReactFlow>
            )}
          </div>

          <aside className="detail-panel">
            {selectedItem ? (
              <>
                <p className="detail-kicker">{sectionLabelFor(selectedItem.section || 'Misc')}</p>
                <h2>{itemTitle(selectedItem)}</h2>
                <p className="detail-copy">{itemDescription(selectedItem)}</p>
                <dl>
                  <div>
                    <dt>Branch</dt>
                    <dd>{branchLabelFor(selectedItem)}</dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>{itemPrice(selectedItem)}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{selectedItem.source || 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{itemTypeLabel(selectedItem)}</dd>
                  </div>
                </dl>
                {selectedItem.image ? <img className="detail-image" src={selectedItem.image} alt="" /> : null}
                {selectedItem.url ? (
                  <a className="action-link" href={selectedItem.url} target="_blank" rel="noreferrer">
                    Open item dossier
                  </a>
                ) : null}
              </>
            ) : (
              <div className="state-panel">Select a node to inspect its dossier.</div>
            )}
          </aside>
        </section>
      </main>
    </ReactFlowProvider>
  );
}

export default App;
