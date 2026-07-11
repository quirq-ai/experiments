import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const {
    domainDefinitions,
    eraDefinitions,
    storyTours,
    technologyEdges,
    technologyNodes,
  } = await server.ssrLoadModule("/src/data/technologyGraph.ts");

  const errors = [];
  const warnings = [];
  const fail = (message) => errors.push(message);

  if (technologyNodes.length < 120) fail(`expected at least 120 nodes; found ${technologyNodes.length}`);
  if (technologyEdges.length < 250) fail(`expected at least 250 edges; found ${technologyEdges.length}`);
  if (domainDefinitions.length < 10) fail(`expected at least 10 domains; found ${domainDefinitions.length}`);
  if (eraDefinitions.length < 8) fail(`expected at least 8 eras; found ${eraDefinitions.length}`);
  if (storyTours.length < 6) fail(`expected at least 6 story tours; found ${storyTours.length}`);

  const nodeById = new Map();
  for (const node of technologyNodes) {
    if (nodeById.has(node.id)) fail(`duplicate node id: ${node.id}`);
    nodeById.set(node.id, node);
    for (const field of ["id", "title", "yearLabel", "era", "domain", "summary", "description", "location"]) {
      if (typeof node[field] !== "string" || !node[field].trim()) fail(`${node.id || "<unknown>"} has an empty ${field}`);
    }
    if (!Number.isFinite(node.year)) fail(`${node.id} has an invalid year`);
    if (!Number.isInteger(node.impact) || node.impact < 1 || node.impact > 5) fail(`${node.id} has invalid impact ${node.impact}`);
    if (!["high", "medium", "low"].includes(node.confidence)) fail(`${node.id} has invalid confidence ${node.confidence}`);
    if (!Array.isArray(node.sources) || node.sources.length === 0) warnings.push(`${node.id} has no source`);
    for (const source of node.sources ?? []) {
      try { new URL(source.url); } catch { fail(`${node.id} has invalid source URL: ${source.url}`); }
    }
  }

  const edgeKeys = new Set();
  const neighborIds = new Map(technologyNodes.map((node) => [node.id, new Set()]));
  let chronologicalInversions = 0;
  for (const edge of technologyEdges) {
    if (!nodeById.has(edge.source)) fail(`edge source does not exist: ${edge.source}`);
    if (!nodeById.has(edge.target)) fail(`edge target does not exist: ${edge.target}`);
    const key = `${edge.source}|${edge.target}|${edge.type}|${edge.label}`;
    if (edgeKeys.has(key)) fail(`duplicate edge: ${key}`);
    edgeKeys.add(key);
    neighborIds.get(edge.source)?.add(edge.target);
    neighborIds.get(edge.target)?.add(edge.source);
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (source && target && source.year > target.year && !["combined-with", "inspired"].includes(edge.type)) {
      chronologicalInversions += 1;
      warnings.push(`chronology review: ${edge.source} (${source.year}) -> ${edge.target} (${target.year}), ${edge.type}`);
    }
  }

  const isolates = [...neighborIds].filter(([, neighbors]) => neighbors.size === 0).map(([id]) => id);
  if (isolates.length) fail(`isolated nodes: ${isolates.join(", ")}`);

  const visited = new Set();
  let componentCount = 0;
  for (const node of technologyNodes) {
    if (visited.has(node.id)) continue;
    componentCount += 1;
    const queue = [node.id];
    visited.add(node.id);
    for (let index = 0; index < queue.length; index += 1) {
      for (const neighbor of neighborIds.get(queue[index]) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
  if (componentCount > 1) fail(`graph has ${componentCount} disconnected components`);

  for (const story of storyTours) {
    if (!story.id || !story.title || !(story.description || story.summary)) fail(`story ${story.id || "<unknown>"} is missing copy`);
    if (!Array.isArray(story.nodeIds) || story.nodeIds.length < 5) fail(`story ${story.id} needs at least 5 nodes`);
    for (const nodeId of story.nodeIds) if (!nodeById.has(nodeId)) fail(`story ${story.id} references missing node ${nodeId}`);
  }

  if (errors.length) {
    console.error("Technology graph validation failed:");
    for (const error of errors) console.error(`  ✗ ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ valid — ${technologyNodes.length} milestones, ${technologyEdges.length} relationships, ${domainDefinitions.length} domains, ${eraDefinitions.length} eras, ${storyTours.length} stories.`);
    console.log(`  One connected component, zero isolates, zero duplicate IDs/endpoints; ${chronologicalInversions} chronology warnings.`);
    if (warnings.filter((warning) => warning.includes("has no source")).length) {
      console.log(`  ${warnings.filter((warning) => warning.includes("has no source")).length} source-coverage warnings.`);
    }
  }
} finally {
  await server.close();
}
