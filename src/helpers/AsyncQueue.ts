import { DeferredPromise } from "./promise"

type Thunk<T> = () => Promise<T>

export class AsyncQueue {
	private queue: Array<Thunk<any>> = []
	private running: Array<Thunk<any>> = []

	constructor(private parallel: number) {}

	public enqueue<T>(thunk: Thunk<T>): Promise<T> {
		const deferred = new DeferredPromise<T>()
		const wrapped = () =>
			thunk()
				.then(deferred.resolve)
				.catch(deferred.reject)
		this.queue.push(wrapped)
		this.flush()
		return deferred.promise
	}

	private flush() {
		if (this.queue.length === 0) {
			return
		}
		if (this.running.length >= this.parallel) {
			return
		}

		// Dequeue and add to the running list.
		const thunks = this.queue.splice(0, this.parallel - this.running.length)
		for (const thunk of thunks) {
			this.running.push(thunk)
		}

		// Run each thunk, remove from running, and flush again.
		for (const thunk of thunks) {
			thunk().then(() => {
				this.running.splice(this.running.indexOf(thunk), 1)
				this.flush()
			})
		}
	}
}
