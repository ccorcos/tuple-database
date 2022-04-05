import { isEmptyWrites } from "../../helpers/isEmptyWrites"
import { KeyValuePair } from "../../storage/types"
import { TxId } from "../types"
import { AsyncTupleDatabaseClient } from "./AsyncTupleDatabaseClient"
import { AsyncTupleDatabaseClientApi } from "./asyncTypes"

const throwError = () => {
	throw new Error()
}

class Queue<T> {
	private items: T[] = []

	constructor(private dequeue: (item: T) => Promise<void>) {}

	private flushing: Promise<void> | undefined

	private async attemptFlush() {
		if (!this.flushing) this.flushing = this.flush()
		return this.flushing
	}

	private async flush() {
		while (this.items.length > 0) {
			const item = this.items.shift()!
			await this.dequeue(item)
		}
		this.flushing = undefined
	}

	public async enqueue(item: T) {
		this.items.push(item)
		await this.attemptFlush()
	}
}

export async function subscribeQueryAsync<S extends KeyValuePair, T>(
	db: AsyncTupleDatabaseClientApi<S>,
	fn: (db: AsyncTupleDatabaseClientApi<S>) => Promise<T>,
	callback: (result: T) => void
): Promise<{ result: T; destroy: () => void }> {
	const listeners = new Set<any>()

	const compute = () => fn(listenDb)

	const resetListeners = () => {
		listeners.forEach((destroy) => destroy())
		listeners.clear()
	}

	let lastComputedTxId: string | undefined
	const recomputeQueue = new Queue<TxId>(async (txId) => {
		// Skip over duplicate emits.
		if (txId === lastComputedTxId) return

		// Recompute.
		lastComputedTxId = txId
		resetListeners()
		const result = await compute()
		callback(result)
	})

	// Subscribe for every scan that gets called.
	const listenDb = new AsyncTupleDatabaseClient<S>({
		scan: async (args: any, txId) => {
			// if (txId)
			// 	// Maybe one day we can transactionally subscribe to a bunch of things. But
			// 	// for now, lets just avoid that...
			// 	throw new Error("Not allowed to subscribe transactionally.")

			const destroy = await db.subscribe(args, async (_writes, txId) =>
				recomputeQueue.enqueue(txId)
			)
			listeners.add(destroy)

			const results = await db.scan(args)
			return results
		},
		cancel: async (txId) => {
			await db.cancel(txId)
		},
		commit: async (writes, txId) => {
			if (!isEmptyWrites(writes))
				throw new Error("No writing in a subscribeQueryAsync.")
			// Commit to resolve conflicts with transactional reads.
			await db.commit({}, txId)
		},
		subscribe: throwError,
		close: throwError,
	})

	const result = await compute()
	const destroy = resetListeners
	return { result, destroy }
}
