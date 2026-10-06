/**
 * @file graph-zoom.ts
 * @brief D3 viewport behavior with settling auto-fit and user-controlled zoom.
 */
import { select, type Selection } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { graphFit, type GraphPoint } from './graph-viewport.js';

type Scene = Selection<SVGGElement, unknown, null, undefined>;

export class GraphViewport {
	private readonly root: Selection<SVGSVGElement, unknown, null, undefined>;
	private readonly behavior: ZoomBehavior<SVGSVGElement, unknown>;
	private automatic = true;
	private subset: Set<string> | null = null;
	private ticks = 0;

	/** @brief Mounts zoom and fits the initial graph. @param svg SVG root. @param scene Graph group. @param nodes Mutable positions. @return Viewport. */
	constructor(
		svg: SVGSVGElement,
		scene: Scene,
		private readonly nodes: (GraphPoint & { slug: string })[]
	) {
		this.root = select(svg);
		this.behavior = zoom<SVGSVGElement, unknown>()
			.extent([
				[0, 0],
				[980, 620]
			])
			.scaleExtent([0.01, 4])
			.on('zoom', (event) => {
				if (event.sourceEvent) this.automatic = false;
				scene.attr('transform', event.transform.toString());
			});
		this.root.call(this.behavior);
		this.paintFit();
	}

	/** @brief Fits positioned nodes and their label bounds. @return Nothing. */
	private paintFit(): void {
		const bounds = graphFit(
			this.nodes.filter((item) => !this.subset || this.subset.has(item.slug))
		);
		this.root.call(
			this.behavior.transform,
			zoomIdentity.translate(bounds.x, bounds.y).scale(bounds.scale)
		);
	}

	/** @brief Keeps the settling simulation in view until manual interaction. @return Nothing. */
	tick(): void {
		if (this.automatic && ++this.ticks % 12 === 0) this.paintFit();
	}

	/** @brief Fits the final positions without overriding reader interactions. @return Nothing. */
	settled(): void {
		if (this.automatic) this.paintFit();
	}

	/** @brief Explicitly fits the current map or focused subset. @return Nothing. */
	fit(): void {
		this.automatic = true;
		this.paintFit();
	}

	/** @brief Fits a selected neighborhood, or the complete graph. @param visible Visible slugs. @return Nothing. */
	focus(visible: Set<string> | null): void {
		this.subset = visible;
		this.fit();
	}

	/** @brief Stops automatic fitting when a node is dragged. @return Nothing. */
	pause(): void {
		this.automatic = false;
	}

	/** @brief Zooms without subsequent simulation recentering. @param factor Zoom multiplier. @return Nothing. */
	zoom(factor: number): void {
		this.automatic = false;
		this.root.call(this.behavior.scaleBy, factor);
	}

	/** @brief Detaches zoom handlers from the SVG. @return Nothing. */
	destroy(): void {
		this.root.on('.zoom', null);
	}
}
