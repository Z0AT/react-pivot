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
const SECTION_WIDTH = 1080;
const SECTION_HEIGHT = 840;
const SECTION_GAP_X = 360;
const SECTION_GAP_Y = 260;
const ITEM_ROW_HEIGHT = 92;
const ITEM_COLUMN_WIDTH = 178;

type GraphMeta = {
  sectionZones: Array<{
    id: string;
    label: string;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    branchCount: number;
  }>;
};

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

function compactNodeTitle(title: string, limit = 24) {
  return title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
}

function NodeCard({ data, selected }: NodeProps<Node<SkillTreeNodeData>>) {
  const item = data.item as DesireCacheItem;
  const title = compactNodeTitle(itemTitle(item), item.status === 'item' ? 22 : 28);
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
          <div className="skill-node__footer compact">
            <span>{itemPrice(item)}</span>
            <span>{item.image ? 'img' : 'fallback'}</span>
          </div>
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
  const meta: GraphMeta = { sectionZones: [] };

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
    const sectionColumn = sectionIndex % 2;
    const sectionRow = Math.floor(sectionIndex / 2);
    const sectionX = sectionColumn * (SECTION_WIDTH + SECTION_GAP_X);
    const sectionY = sectionRow * (SECTION_HEIGHT + SECTION_GAP_Y);
    const sectionNodeX = sectionX + 56;
    const sectionNodeY = sectionY + 72;

    meta.sectionZones.push({
      id: sectionId,
      label: sectionLabelFor(section),
      color,
      x: sectionX,
      y: sectionY,
      width: SECTION_WIDTH,
      height: SECTION_HEIGHT,
      branchCount: branches.size
    });

    nodes.push({
      id: sectionId,
      type: 'skill',
      position: { x: sectionNodeX, y: sectionNodeY },
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
      draggable: false,
      selectable: true
    });

    Array.from(branches.entries()).forEach(([branch, branchItems], branchIndex) => {
      const branchId = `branch:${section}:${branch}`;
      const branchY = sectionY + 180 + branchIndex * 152;
      const branchX = sectionX + 230;
      const branchNodeX = branchX;
      const branchNodeY = branchY;

      nodes.push({
        id: branchId,
        type: 'skill',
        position: { x: branchNodeX, y: branchNodeY },
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
        draggable: false,
        selectable: true
      });

      edges.push({
        id: `edge:${sectionId}:${branchId}`,
        source: sectionId,
        target: branchId,
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 2.6, opacity: 0.8 }
      });

      const itemsPerRow = Math.max(1, Math.ceil(branchItems.length / 2));

      branchItems.forEach((item, itemIndex) => {
        const nodeId = `item:${item.id}`;
        const itemRow = Math.floor(itemIndex / itemsPerRow);
        const itemColumn = itemIndex % itemsPerRow;
        const nodeX = sectionX + 520 + itemColumn * ITEM_COLUMN_WIDTH;
        const nodeY = branchY - 20 + itemRow * ITEM_ROW_HEIGHT;

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
          draggable: false,
          selectable: true
        });

        if (itemRow === 0) {
          edges.push({
            id: `edge:${branchId}:${nodeId}`,
            source: branchId,
            target: nodeId,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color },
            style: { stroke: color, strokeWidth: 1.8, opacity: 0.42 }
          });
        }
      });
    });
  });

  return { nodes, edges, meta };
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
              Clear section neighborhoods, branch rails, and compact nodes first. The board should read before it dazzles.
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
            {graph.meta.sectionZones.map((zone) => (
              <div
                key={zone.id}
                className="section-zone"
                style={{
                  left: zone.x,
                  top: zone.y,
                  width: zone.width,
                  height: zone.height,
                  ['--zone-color' as string]: zone.color
                }}
              >
                <div className="section-zone__header">
                  <span>{zone.label}</span>
                  <small>{zone.branchCount} branches</small>
                </div>
              </div>
            ))}

            {error ? (
              <div className="state-panel error overlay-state">{error}</div>
            ) : (
              <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.12, minZoom: 0.42 }}
                defaultViewport={{ x: 0, y: 0, zoom: 0.52 }}
                onNodeClick={(_, node) => setSelectedItem(node.data.item as DesireCacheItem)}
                onNodeMouseEnter={(_, node) => {
                  if ((node.data.item as DesireCacheItem).status === 'item') {
                    setSelectedItem(node.data.item as DesireCacheItem);
                  }
                }}
                minZoom={0.28}
                maxZoom={1.35}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                proOptions={{ hideAttribution: true }}
              >
                <MiniMap pannable zoomable nodeColor={(node) => String(node.data?.nodeColor ?? DEFAULT_NODE_COLOR)} />
                <Controls />
                <Background color="#15203a" gap={28} size={1.1} />
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
