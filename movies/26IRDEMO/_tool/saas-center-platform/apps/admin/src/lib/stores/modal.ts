import { writable } from 'svelte/store';
import type { Component } from 'svelte';
import { generateId } from '../utils/generator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = Component<any, any, any>;

export interface ModalConfig<T = any, R = any> {
	id: string;
	component: AnyComponent;
	props: T;
	options?: ModalOptions;
	resolve?: (value: R | PromiseLike<R>) => void;
	reject?: (reason?: any) => void;
}

export interface ModalOptions {
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'wide' | 'full' | 'fit';
	customWidth?: number;
	customHeight?: number;
	closeOnBackdropClick?: boolean;
	closeOnEscape?: boolean;
	persistent?: boolean;
	className?: string;
}

interface ModalState {
	modals: ModalConfig[];
	isOpen: boolean;
}

const initialState: ModalState = {
	modals: [],
	isOpen: false
};

function createModalStore() {
	const { subscribe, update } = writable<ModalState>(initialState);

	const openWithPromise = <T = any, R = any>(
		component: AnyComponent,
		props: T,
		options?: ModalOptions
	): Promise<R> => {
		return new Promise((resolve, reject) => {
			const id = generateId();
			const modalConfig: ModalConfig<T, R> = {
				id,
				component,
				props: {
					...props,
					modalId: id,
					closeModal: () => close(id),
					_modalResolve: resolve,
					_modalReject: reject
				} as T,
				options,
				resolve,
				reject
			};

			update((state) => ({
				modals: [...state.modals, modalConfig],
				isOpen: true
			}));
		});
	};

	const open = <T = any>(config: { component: AnyComponent; props: T; options?: ModalOptions }) => {
		const id = generateId();
		const modalConfig: ModalConfig<T> = {
			id,
			component: config.component,
			props: {
				...config.props,
				modalId: id,
				closeModal: () => close(id)
			} as T,
			options: config.options
		};

		update((state) => ({
			modals: [...state.modals, modalConfig],
			isOpen: true
		}));

		return id;
	};

	const close = (id?: string) => {
		update((state) => {
			let newModals: ModalConfig[];

			if (id) {
				const modal = state.modals.find((m) => m.id === id);
				if (!modal) return state;
				if (modal.resolve) modal.resolve(null);
				newModals = state.modals.filter((m) => m.id !== id);
			} else {
				if (state.modals.length === 0) return state;
				const topModal = state.modals[state.modals.length - 1];
				if (topModal.resolve) topModal.resolve(null);
				newModals = state.modals.slice(0, -1);
			}

			return {
				modals: newModals,
				isOpen: newModals.length > 0
			};
		});
	};

	const closeAll = () => {
		update((state) => {
			state.modals.forEach((modal) => {
				if (modal.resolve) modal.resolve(null);
			});
			return initialState;
		});
	};

	const resolve = <T = any>(id: string, result: T) => {
		update((state) => {
			const modal = state.modals.find((m) => m.id === id);
			if (modal?.resolve) modal.resolve(result);
			const newModals = state.modals.filter((m) => m.id !== id);
			return {
				modals: newModals,
				isOpen: newModals.length > 0
			};
		});
	};

	return {
		subscribe,
		open,
		openWithPromise,
		close,
		closeAll,
		resolve
	};
}

export const modalStore = createModalStore();
