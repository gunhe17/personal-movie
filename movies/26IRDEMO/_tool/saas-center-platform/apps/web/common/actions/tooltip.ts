import { hideTooltip, showTooltip } from '../../src/lib/stores/tooltip';

import type { AbsPlacement } from '../../common/common';

type TooltipParams = {
	content: string;
	placement?: AbsPlacement;
};

export const tooltip = (node: HTMLElement | any, params: TooltipParams | string) => {
	let content = typeof params === 'string' ? params : params.content;
	let placement = typeof params === 'string' ? 'top' : (params.placement ?? 'top');

	const onEnter = (e: MouseEvent) => {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();

		let x = rect.left + rect.width / 2;
		let y = rect.top + rect.height / 2;

		if (placement === 'top') {
			y = rect.top;
		} else if (placement === 'bottom') {
			y = rect.bottom;
		} else if (placement === 'left') {
			x = rect.left;
		} else if (placement === 'right') {
			x = rect.right;
		}

		showTooltip(content, x, y, placement);
	};

	const onLeave = () => hideTooltip();

	node.addEventListener('mouseenter', onEnter);
	node.addEventListener('mouseleave', onLeave);
	node.addEventListener('blur', onLeave);

	return {
		update: (next: TooltipParams | string) => {
			content = typeof next === 'string' ? next : next.content;
			placement = typeof next === 'string' ? 'top' : (next.placement ?? 'top');
		},
		destroy: () => {
			node.removeEventListener('mouseenter', onEnter);
			node.removeEventListener('mouseleave', onLeave);
			node.removeEventListener('blur', onLeave);
		}
	};
};
