export class TimeoutPromise extends Promise<void> {
	constructor(time: number) {
		super(resolve => {
			setTimeout(() => {
				resolve()
			}, time)
		})
	}
}

export class DeferredPromise<T> {
	resolve: (value: T) => void
	reject: (error: any) => void
	promise: Promise<T>
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		})
	}
}
