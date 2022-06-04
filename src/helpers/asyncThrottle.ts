// TODO: tests

export function asyncThrottle(fn: () => Promise<void>) {
	let promise: Promise<void> | undefined
	let queued: Promise<void> | undefined

	return async () => {
		// This only runs the first time.
		if (!promise) {
			promise = fn()
			return promise
		}

		if (queued) {
			return queued
		}

		queued = promise.then(() => {
			queued = undefined
			promise = fn()
			return promise
		})

		return queued
	}
}
