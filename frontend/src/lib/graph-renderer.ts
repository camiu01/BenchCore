/**
 * @file graph-renderer.ts
 * @brief D3 rendering adapter for the interactive public post graph.
 */
import { drag, type D3DragEvent } from 'd3-drag';
import {
	forceCenter,
	forceCollide,
	forceLink,
	forceManyBody,
	forceSimulation,
	type Simulation,
	type SimulationLinkDatum,
	type SimulationNodeDatum
} from 'd3-force';
import { select, type Selection } from 'd3-selection';
import type { GraphData } from './api.js';
import { DEFAULT_LOCALE } from './i18n/locale.js';
import { translator } from './i18n/translate.js';
import { matchesGraphNode, relatedGraphNodes } from './graph-navigation.js';
import { focusedGraphSlugs } from './graph-viewport.js';
import { GraphViewport } from './graph-zoom.js';
import type { PreviewController } from './linked-previews.js';

type SimNode = GraphData['nodes'][number] & SimulationNodeDatum & { degree: number };
interface SimLink extends SimulationLinkDatum<SimNode> {
	source: string | SimNode;
	target: string | SimNode;
}
type NodeSelection = Selection<SVGCircleElement, SimNode, SVGGElement, unknown>;
type LinkSelection = Selection<SVGLineElement, SimLink, SVGGElement, unknown>;
type LabelSelection = Selection<SVGTextElement, SimNode, SVGGElement, unknown>;

export interface GraphController {
	filter(query: string): void;
	select(slug: string | null): void;
	focus(slug: string | null): void;
	reset(): void;
	zoom(factor: number): void;
	destroy(): void;
}

/** @brief Builds simulation nodes and links. @param graph Public graph. @return Mutable D3 model. */
export function buildModel(graph: GraphData): { nodes: SimNode[]; links: SimLink[] } {
	const degrees = new Map<string, number>();
	for (const edge of graph.edges) {
		degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
		degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
	}
	return {
		nodes: graph.nodes.map((node) => ({ ...node, degree: degrees.get(node.slug) ?? 0 })),
		links: graph.edges.map((edge) => ({ ...edge }))
	};
}

/** @brief Draws graph primitives. @param svg SVG root. @param nodes Nodes. @param links Edges. @param tr Message translator. @return D3 selections. */
function drawScene(
	svg: SVGSVGElement,
	nodes: SimNode[],
	links: SimLink[],
	tr: ReturnType<typeof translator>
) {
	const root = select(svg);
	const scene = root.append('g').attr('class', 'graph-scene');
	const link = scene
		.append('g')
		.attr('class', 'graph-links')
		.selectAll<SVGLineElement, SimLink>('line')
		.data(links)
		.join('line');
	const node = scene
		.append('g')
		.attr('class', 'graph-nodes')
		.selectAll<SVGCircleElement, SimNode>('circle')
		.data(nodes)
		.join('circle')
		.attr('r', (item) => Math.min(16, 7 + item.degree * 1.5))
		.attr('fill', (item) => item.tags[0]?.color ?? '#64748B')
		.attr('tabindex', 0)
		.attr('role', 'button')
		.attr('aria-label', (item) =>
			tr(item.degree === 1 ? 'public.graph.nodeOne' : 'public.graph.nodeMany', {
				title: item.title,
				n: item.degree
			})
		);
	node.append('title').text((item) => item.title);
	const label = scene
		.append('g')
		.attr('class', 'graph-labels')
		.selectAll<SVGTextElement, SimNode>('text')
		.data(nodes)
		.join('text')
		.text((item) => (item.title.length > 38 ? `${item.title.slice(0, 35)}…` : item.title));
	return { root, scene, link, node, label };
}

/** @brief Starts and paints the force simulation. @param nodes Nodes. @param links Edges. @param link Lines. @param node Circles. @param label Labels. @return Simulation. */
function startSimulation(
	nodes: SimNode[],
	links: SimLink[],
	link: LinkSelection,
	node: NodeSelection,
	label: LabelSelection
): Simulation<SimNode, SimLink> {
	const simulation = forceSimulation(nodes)
		.force(
			'link',
			forceLink<SimNode, SimLink>(links)
				.id((item) => item.slug)
				.distance(105)
				.strength(0.6)
		)
		.force('charge', forceManyBody().strength(-260))
		.force('center', forceCenter(490, 310))
		.force(
			'collision',
			forceCollide<SimNode>().radius((item) => Math.min(16, 7 + item.degree * 1.5) + 20)
		);
	simulation.on('tick', () => {
		link
			.attr('x1', (item) => (item.source as SimNode).x ?? 0)
			.attr('y1', (item) => (item.source as SimNode).y ?? 0)
			.attr('x2', (item) => (item.target as SimNode).x ?? 0)
			.attr('y2', (item) => (item.target as SimNode).y ?? 0);
		node.attr('cx', (item) => item.x ?? 0).attr('cy', (item) => item.y ?? 0);
		label.attr('x', (item) => (item.x ?? 0) + 12).attr('y', (item) => (item.y ?? 0) + 4);
	});
	return simulation;
}

/** @brief Enables pointer, keyboard, previews and drag interaction. @param node Circles. @param simulation Simulation. @param onSelect Selection callback. @param onInteract Interaction callback. @param previews Preview coordinator. @return Nothing. */
function enableNodeInteraction(
	node: NodeSelection,
	simulation: Simulation<SimNode, SimLink>,
	onSelect: (slug: string) => void,
	onInteract: () => void,
	previews?: PreviewController
): void {
	node
		.on('click', (_event, item) => onSelect(item.slug))
		.on('pointerenter', function (_event, item) {
			previews?.open(item.slug, this);
		})
		.on('pointerleave', () => previews?.close())
		.on('focus', function (_event, item) {
			previews?.open(item.slug, this);
		})
		.on('blur', () => previews?.close())
		.on('keydown', (event, item) => {
			if (event.key === 'Escape') {
				previews?.dismiss();
				return;
			}
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			onSelect(item.slug);
		});
	node.call(
		drag<SVGCircleElement, SimNode>()
			.on('start', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, item) => {
				onInteract();
				if (!event.active) simulation.alphaTarget(0.25).restart();
				item.fx = item.x;
				item.fy = item.y;
			})
			.on('drag', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, item) => {
				item.fx = event.x;
				item.fy = event.y;
			})
			.on('end', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, item) => {
				if (!event.active) simulation.alphaTarget(0);
				item.fx = null;
				item.fy = null;
			})
	);
}

/** @brief Hides unrelated graph primitives without leaving invisible keyboard targets. @param node Circles. @param label Labels. @param link Lines. @param visible Focus subset. @return Nothing. */
function showNeighborhood(
	node: NodeSelection,
	label: LabelSelection,
	link: LinkSelection,
	visible: Set<string> | null
): void {
	node
		.attr('display', (item) => (visible && !visible.has(item.slug) ? 'none' : null))
		.attr('tabindex', (item) => (visible && !visible.has(item.slug) ? -1 : 0));
	label.attr('display', (item) => (visible && !visible.has(item.slug) ? 'none' : null));
	link.attr('display', (item) => {
		const source = typeof item.source === 'string' ? item.source : item.source.slug;
		const target = typeof item.target === 'string' ? item.target : item.target.slug;
		return visible && (!visible.has(source) || !visible.has(target)) ? 'none' : null;
	});
}

/** @brief Creates graph search highlighting. @param node Circles. @param label Labels. @return Filter callback. */
function createFilter(node: NodeSelection, label: LabelSelection): (query: string) => void {
	return (query) => {
		const muted = (item: SimNode) => !matchesGraphNode(item, query);
		node.classed('search-muted', muted);
		label.classed('search-muted', muted);
	};
}

/** @brief Creates connected-node highlighting. @param graph Public graph. @param node Circles. @param label Labels. @param link Lines. @return Selection callback. */
function createSelection(
	graph: GraphData,
	node: NodeSelection,
	label: LabelSelection,
	link: LinkSelection
): (slug: string | null) => void {
	return (slug) => {
		const neighbors = new Set([slug]);
		for (const related of relatedGraphNodes(graph, slug)) neighbors.add(related.slug);
		node
			.classed('selected', (item) => item.slug === slug)
			.classed('selection-muted', (item) => slug !== null && !neighbors.has(item.slug));
		label.classed('selection-muted', (item) => slug !== null && !neighbors.has(item.slug));
		link.classed('selection-muted', (item) => {
			const source = typeof item.source === 'string' ? item.source : item.source.slug;
			const target = typeof item.target === 'string' ? item.target : item.target.slug;
			return slug !== null && (!neighbors.has(source) || !neighbors.has(target));
		});
	};
}

/**
 * @brief Mounts an interactive graph and returns its controls.
 * @param svg SVG root.
 * @param graph Public graph.
 * @param onSelect Selection callback.
 * @param previews Optional delayed preview coordinator.
 * @param tr Message translator.
 * @return Graph controls and cleanup.
 */
export function createGraphRenderer(
	svg: SVGSVGElement,
	graph: GraphData,
	onSelect: (slug: string) => void,
	previews?: PreviewController,
	tr: ReturnType<typeof translator> = translator(DEFAULT_LOCALE)
): GraphController {
	const { nodes, links } = buildModel(graph);
	const { scene, link, node, label } = drawScene(svg, nodes, links, tr);
	const simulation = startSimulation(nodes, links, link, node, label);
	const viewport = new GraphViewport(svg, scene, nodes);
	simulation.on('tick.viewport', () => viewport.tick());
	simulation.on('end.viewport', () => viewport.settled());
	enableNodeInteraction(node, simulation, onSelect, () => viewport.pause(), previews);
	return {
		filter: createFilter(node, label),
		select: createSelection(graph, node, label, link),
		focus: (slug) => {
			const visible = focusedGraphSlugs(graph, slug);
			showNeighborhood(node, label, link, visible);
			viewport.focus(visible);
		},
		reset: () => viewport.fit(),
		zoom: (factor) => viewport.zoom(factor),
		destroy: () => {
			simulation.stop();
			viewport.destroy();
		}
	};
}
