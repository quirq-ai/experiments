import type { TechnologyEdge, TechnologyNode } from "../types";

export type GraphDirection = "outgoing" | "incoming" | "both";

export interface GraphIndex {
  nodeById: ReadonlyMap<string, TechnologyNode>;
  edgesBySource: ReadonlyMap<string, readonly TechnologyEdge[]>;
  edgesByTarget: ReadonlyMap<string, readonly TechnologyEdge[]>;
  edgesByNode: ReadonlyMap<string, readonly TechnologyEdge[]>;
  neighborIdsByNode: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface TraversalOptions {
  direction?: GraphDirection;
  nodeFilter?: (node: TechnologyNode) => boolean;
  edgeFilter?: (edge: TechnologyEdge) => boolean;
}

export interface GraphPath {
  nodeIds: string[];
  nodes: TechnologyNode[];
  edges: TechnologyEdge[];
}

export interface AdjacentNode {
  node: TechnologyNode;
  edge: TechnologyEdge;
  direction: Exclude<GraphDirection, "both">;
}

export interface FacetMetadata {
  id: string;
  label: string;
  count: number;
  earliestYear: number;
  latestYear: number;
  nodeIds: string[];
}

const addToListMap = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const values = map.get(key);
  if (values) {
    values.push(value);
  } else {
    map.set(key, [value]);
  }
};

const addToSetMap = <T>(map: Map<string, Set<T>>, key: string, value: T) => {
  const values = map.get(key);
  if (values) {
    values.add(value);
  } else {
    map.set(key, new Set([value]));
  }
};

/** Build all frequently used graph lookups once, including isolated nodes. */
export function buildGraphIndex(
  nodes: readonly TechnologyNode[],
  edges: readonly TechnologyEdge[],
): GraphIndex {
  const nodeById = new Map<string, TechnologyNode>();
  const edgesBySource = new Map<string, TechnologyEdge[]>();
  const edgesByTarget = new Map<string, TechnologyEdge[]>();
  const edgesByNode = new Map<string, TechnologyEdge[]>();
  const neighborIdsByNode = new Map<string, Set<string>>();

  for (const node of nodes) {
    nodeById.set(node.id, node);
    edgesBySource.set(node.id, []);
    edgesByTarget.set(node.id, []);
    edgesByNode.set(node.id, []);
    neighborIdsByNode.set(node.id, new Set());
  }

  for (const edge of edges) {
    addToListMap(edgesBySource, edge.source, edge);
    addToListMap(edgesByTarget, edge.target, edge);
    addToListMap(edgesByNode, edge.source, edge);
    if (edge.target !== edge.source) {
      addToListMap(edgesByNode, edge.target, edge);
    }
    addToSetMap(neighborIdsByNode, edge.source, edge.target);
    addToSetMap(neighborIdsByNode, edge.target, edge.source);
  }

  return {
    nodeById,
    edgesBySource,
    edgesByTarget,
    edgesByNode,
    neighborIdsByNode,
  };
}

export const indexGraph = buildGraphIndex;

function edgesForDirection(
  index: GraphIndex,
  nodeId: string,
  direction: GraphDirection,
): readonly TechnologyEdge[] {
  if (direction === "outgoing") {
    return index.edgesBySource.get(nodeId) ?? [];
  }
  if (direction === "incoming") {
    return index.edgesByTarget.get(nodeId) ?? [];
  }
  return index.edgesByNode.get(nodeId) ?? [];
}

function adjacentId(
  edge: TechnologyEdge,
  nodeId: string,
  direction: GraphDirection,
): string | undefined {
  if (direction === "outgoing") {
    return edge.source === nodeId ? edge.target : undefined;
  }
  if (direction === "incoming") {
    return edge.target === nodeId ? edge.source : undefined;
  }
  if (edge.source === nodeId) return edge.target;
  if (edge.target === nodeId) return edge.source;
  return undefined;
}

/** Return traversable adjacent nodes together with the connecting edge. */
export function getAdjacency(
  index: GraphIndex,
  nodeId: string,
  options: TraversalOptions = {},
): AdjacentNode[] {
  const direction = options.direction ?? "both";
  const adjacent: AdjacentNode[] = [];

  for (const edge of edgesForDirection(index, nodeId, direction)) {
    if (options.edgeFilter && !options.edgeFilter(edge)) continue;

    const nextId = adjacentId(edge, nodeId, direction);
    if (!nextId) continue;

    const node = index.nodeById.get(nextId);
    if (!node || (options.nodeFilter && !options.nodeFilter(node))) continue;

    adjacent.push({
      node,
      edge,
      direction: edge.source === nodeId ? "outgoing" : "incoming",
    });
  }

  return adjacent;
}

/** Return unique adjacent node IDs after applying the optional filters. */
export function getNeighborIds(
  index: GraphIndex,
  nodeId: string,
  options: TraversalOptions = {},
): string[] {
  const ids = new Set<string>();
  for (const adjacent of getAdjacency(index, nodeId, options)) {
    ids.add(adjacent.node.id);
  }
  return [...ids];
}

/** Breadth-first shortest path for directed or undirected graph exploration. */
export function findShortestPath(
  index: GraphIndex,
  sourceId: string,
  targetId: string,
  options: TraversalOptions = {},
): GraphPath | null {
  const source = index.nodeById.get(sourceId);
  const target = index.nodeById.get(targetId);
  if (!source || !target) return null;
  if (options.nodeFilter && (!options.nodeFilter(source) || !options.nodeFilter(target))) {
    return null;
  }
  if (sourceId === targetId) {
    return { nodeIds: [sourceId], nodes: [source], edges: [] };
  }

  const queue = [sourceId];
  let cursor = 0;
  const visited = new Set([sourceId]);
  const previous = new Map<string, { nodeId: string; edge: TechnologyEdge }>();

  while (cursor < queue.length) {
    const currentId = queue[cursor];
    cursor += 1;

    for (const adjacent of getAdjacency(index, currentId, options)) {
      const nextId = adjacent.node.id;
      if (visited.has(nextId)) continue;

      visited.add(nextId);
      previous.set(nextId, { nodeId: currentId, edge: adjacent.edge });

      if (nextId === targetId) {
        const nodeIds = [targetId];
        const pathEdges: TechnologyEdge[] = [];
        let stepId = targetId;

        while (stepId !== sourceId) {
          const step = previous.get(stepId);
          if (!step) return null;
          pathEdges.push(step.edge);
          stepId = step.nodeId;
          nodeIds.push(stepId);
        }

        nodeIds.reverse();
        pathEdges.reverse();
        return {
          nodeIds,
          nodes: nodeIds.flatMap((id) => {
            const node = index.nodeById.get(id);
            return node ? [node] : [];
          }),
          edges: pathEdges,
        };
      }

      queue.push(nextId);
    }
  }

  return null;
}

export const shortestPath = findShortestPath;

export function groupNodesBy(
  nodes: readonly TechnologyNode[],
  selectKey: (node: TechnologyNode) => string,
): Map<string, TechnologyNode[]> {
  const groups = new Map<string, TechnologyNode[]>();
  for (const node of nodes) {
    addToListMap(groups, selectKey(node), node);
  }
  return groups;
}

export const groupNodesByDomain = (nodes: readonly TechnologyNode[]) =>
  groupNodesBy(nodes, (node) => node.domain);

export const groupNodesByEra = (nodes: readonly TechnologyNode[]) =>
  groupNodesBy(nodes, (node) => node.era);

const titleFromId = (id: string) =>
  id
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

function summarizeGroups(groups: ReadonlyMap<string, readonly TechnologyNode[]>): FacetMetadata[] {
  const metadata: FacetMetadata[] = [];

  for (const [id, nodes] of groups) {
    let earliestYear = Number.POSITIVE_INFINITY;
    let latestYear = Number.NEGATIVE_INFINITY;
    const nodeIds: string[] = [];

    for (const node of nodes) {
      if (node.year < earliestYear) earliestYear = node.year;
      if (node.year > latestYear) latestYear = node.year;
      nodeIds.push(node.id);
    }

    metadata.push({
      id,
      label: titleFromId(id),
      count: nodes.length,
      earliestYear,
      latestYear,
      nodeIds,
    });
  }

  return metadata;
}

export function getDomainMetadata(nodes: readonly TechnologyNode[]): FacetMetadata[] {
  return summarizeGroups(groupNodesByDomain(nodes)).sort((a, b) => a.label.localeCompare(b.label));
}

export function getEraMetadata(nodes: readonly TechnologyNode[]): FacetMetadata[] {
  return summarizeGroups(groupNodesByEra(nodes)).sort(
    (a, b) => a.earliestYear - b.earliestYear || a.label.localeCompare(b.label),
  );
}

export const metadataById = (metadata: readonly FacetMetadata[]) =>
  new Map(metadata.map((item) => [item.id, item]));
