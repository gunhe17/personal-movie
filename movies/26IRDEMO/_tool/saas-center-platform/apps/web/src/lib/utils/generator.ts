export const generateId = (isModal: boolean = true): string => {
	return `${isModal ? 'modal' : 'panel'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// crypto.randomUUID는 secure context(https/localhost) 전용 — LAN IP 접속 폴백
export const randomId = (): string => {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
