import { writable } from 'svelte/store';

export interface ExcelClientData {
	id: string;
	status: 'new' | 'existing'; // 신규/기존
	name: string;
	gender: 'male' | 'female' | '';
	birthDate: string;
	organization: string;
	guardianName: string;
	guardianRelationship: string; // 관계 (엄마, 아빠, 형, 언니 등)
	guardianGender?: 'male' | 'female' | '';
	guardianBirthDate?: string;
	guardianPhone: string;
	guardianEmail?: string;
	address?: string;
}

interface ExcelUploadState {
	clients: ExcelClientData[];
	fileName: string;
}

const initialState: ExcelUploadState = {
	clients: [],
	fileName: ''
};

function createExcelUploadStore() {
	const { subscribe, set, update } = writable<ExcelUploadState>(initialState);

	return {
		subscribe,
		setData: (clients: ExcelClientData[], fileName: string) => {
			set({ clients, fileName });
		},
		updateClient: (id: string, data: Partial<ExcelClientData>) => {
			update((state) => ({
				...state,
				clients: state.clients.map((client) =>
					client.id === id ? { ...client, ...data } : client
				)
			}));
		},
		removeClient: (id: string) => {
			update((state) => ({
				...state,
				clients: state.clients.filter((client) => client.id !== id)
			}));
		},
		clear: () => set(initialState)
	};
}

export const excelUploadStore = createExcelUploadStore();
