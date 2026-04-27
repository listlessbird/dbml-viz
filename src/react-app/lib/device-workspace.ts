const DEVICE_ID_STORAGE_KEY = "dbml-viz:device-id";

export const getOrCreateDeviceId = (): string => {
	try {
		const stored = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
		if (stored) return stored;
	} catch {
		// Storage can be unavailable in private browsing or locked-down contexts.
	}

	const deviceId = crypto.randomUUID();
	try {
		window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
	} catch {
		// The in-memory id still lets the current attach attempt proceed.
	}
	return deviceId;
};
