import {
	forceLink as d3ForceLink,
	forceCollide as d3ForceCollide,
	forceManyBody as d3ForceManyBody,
	forceSimulation as d3ForceSimulation,
	forceX as d3ForceX,
	forceY as d3ForceY,
} from 'd3';
import { SubGraphRenderer } from './SubGraphRenderer';
import { HierarchicalGraphRenderer, GraphHierarchicalConstructorProps } from './HierarchicalGraphRenderer';
import {
	classNames,
	positionParentLinkNodes,
	forceClampToRadius,
	shortenLine,
	translateCenter,
	isInteractionFocus,
} from './layout-utils';
import { HierarchicalGraphLink, HierarchicalGraphNode } from '../GraphData/types';
import { defNum } from '../utils';

/** an intermediary graph that renders 'groups' of sub nodes */
export class GroupGraphRenderer extends HierarchicalGraphRenderer {
	constructor(props: GraphHierarchicalConstructorProps) {
		super(props);

		this.nodes.forEach((d) => (d.r = d.type === 'keyNode' ? GroupGraphRenderer.radius(d) : 1.5));

		const forceNode = d3ForceManyBody<HierarchicalGraphNode>().strength((d) => {
			return d.type === 'keyNode' ? (d.graphLinks.length || 1) * -2 - 1 : 0;
		});
		const forceLink = d3ForceLink(this.links)
			// .strength(d=>d.children.length > 1 ? 0. : 0)
			// .strength(d => d.group ? 0.2 : 0.05)
			.strength((d) => d.source.graphLinks.length / 100)
			.distance(
				// @ts-ignore
				this.keyNodes.length < 2
					? this.rootNode.r!
					: (d: HierarchicalGraphLink) =>
							//
							this.rootNode.r! / this.links.length + (d.source.r || 1)
			);
		const forceClamp = forceClampToRadius<HierarchicalGraphNode>((d) =>
			d.type === 'keyNode' ? d.parent!.r! - d.r! - 2 : undefined
		);
		const forceCollide = d3ForceCollide<HierarchicalGraphNode>().radius((d): number =>
			d.type === 'keyNode' ? d.r! + 2 : 0
		);
		const forcePositionParentLinkNodes = () => positionParentLinkNodes(this.rootNode);

		this.simulation = d3ForceSimulation(this.nodes)
			.force('positionParentLinkNodes', forcePositionParentLinkNodes)
			.force('link', forceLink)
			.force('charge', forceNode)
			.force('collide', forceCollide)
			.force('x', d3ForceX(0).strength(0.05))
			.force('y', d3ForceY(0).strength(0.05))
			.force('clamp', forceClamp)
			.on('tick', this.drawLayout.bind(this));

		this.rootGroupSelection = this.rootSelection
			.data([this.rootNode])
			.append('g')
			.classed(classNames.groupGraph, true)
			.attr('transform-origin', 'center');

		this.linkSelection = this.rootGroupSelection
			.append('g')
			.selectAll('line')
			.data(this.links)
			.join('line')
			.attr('class', (d) => (d.type === 'siblingLink' ? classNames.siblingLink : classNames.parentLink));

		this.childGraphRootSelection = this.rootGroupSelection
			//
			.append('g')
			.selectAll('g')
			.data(this.nodes)
			.join('g')
			.call(this.graphHandler.initializeDrag(this));

		this.nodeSelection = this.childGraphRootSelection
			.append('g')
			.append('circle')
			.attr('r', (d) => d.r || 0)
			.style('pointer-events', 'none') // not interactive, layout only
			.attr('class', (d) => (d.type === 'parentLinkNode' ? classNames.parentLinkNode : classNames.keyNode))
			.classed(classNames.groupNode, true);

		this.hideLayout(); // start hidden
		// super.initialize();
		super.initialize(SubGraphRenderer);
	}

	drawLayout() {
		const { rk = 1 } = this.graphHandler.zoomTransform;

		// TODO: this doesn't work right for internal beacon connections
		// ...shortenLine assumes that only the source should be shortened?
		this.linkSelection
			.each((d) => {
				d.shortLink = shortenLine(
					defNum(d.target?.x),
					defNum(d.target?.y),
					defNum(d.source?.x),
					defNum(d.source?.y),
					d?.source?.r
				);
			})
			.attr('x1', (d) => d.shortLink.source.x * rk)
			.attr('y1', (d) => d.shortLink.source.y * rk)
			.attr('x2', (d) => d.shortLink.target.x * rk)
			.attr('y2', (d) => d.shortLink.target.y * rk);

		this.childGraphRootSelection.attr('transform', (d) => translateCenter({ d, rk }));

		this.nodeSelection.attr('r', (d) => defNum(d.r) * (d.descendants! ? rk : 1));
	}

	drawInteraction() {
		if (isInteractionFocus(this.rootNode!)) {
			this.showLayout();
			super.drawInteraction();
		} else {
			this.hideLayout();
		}
	}

	static radius = (d: HierarchicalGraphNode): number => {
		const childNeededRadius = 4;
		const childCount = d.children ? d.children.filter((d) => d.type === 'keyNode').length : 1;
		const areaNeeded = Math.pow(childNeededRadius, 2) * Math.PI * childCount;
		return Math.sqrt(areaNeeded / Math.PI);
	};
}
