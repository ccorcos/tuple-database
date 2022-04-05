export function afterMaybePromise(value: any, fn: () => void) {
	if (value instanceof Promise) {
		return value.then(fn)
	} else {
		return fn()
	}
}
