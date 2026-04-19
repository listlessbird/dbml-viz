type IdleWindow = Window &
	typeof globalThis & {
		requestIdleCallback?: (
			callback: (deadline: IdleDeadline) => void,
			options?: IdleRequestOptions,
		) => number;
		cancelIdleCallback?: (handle: number) => void;
	};

export interface ScheduleIdleCallbackOptions {
	readonly timeout?: number;
	readonly fallbackDelay?: number;
}

export const scheduleIdleCallback = (
	callback: () => void,
	{ timeout = 2000, fallbackDelay = 1200 }: ScheduleIdleCallbackOptions = {},
) => {
	const idleWindow = window as IdleWindow;

	if (typeof idleWindow.requestIdleCallback === "function") {
		return idleWindow.requestIdleCallback(() => callback(), { timeout });
	}

	return window.setTimeout(callback, fallbackDelay);
};

export const cancelIdleCallback = (handle: number) => {
	const idleWindow = window as IdleWindow;

	if (typeof idleWindow.cancelIdleCallback === "function") {
		idleWindow.cancelIdleCallback(handle);
		return;
	}

	window.clearTimeout(handle);
};
