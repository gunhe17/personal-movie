import { writable } from 'svelte/store';

import type { AbsPlacement } from '@common/types/common';

type TooltipState = {
	visible: boolean;
	x: number;
	y: number;
	text: string;
	placement: AbsPlacement;
};

export const tooltipStore = writable<TooltipState>({
	visible: false,
	text: '',
	x: 0,
	y: 0,
	placement: 'bottom'
});

export const showTooltip = (
	text: string,
	x: number,
	y: number,
	placement: AbsPlacement = 'bottom'
) => tooltipStore.set({ visible: true, text, x, y, placement });

export const hideTooltip = () => {
	tooltipStore.update((t) => ({ ...t, visible: false }));
};

export const moveTooltip = (x: number, y: number) => {
	tooltipStore.update((t) => ({ ...t, x, y }));
};
