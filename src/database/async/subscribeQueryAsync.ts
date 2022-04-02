import { KeyValuePair } from "../../storage/types"
import { AsyncTupleDatabaseClient } from "./AsyncTupleDatabaseClient"
import {
	AsyncTupleDatabaseClientApi,
	ReadOnlyAsyncTupleDatabaseClientApi,
} from "./asyncTypes"

const throwError = () => {
	throw new Error()
}

export async function subscribeQueryAsync<S extends KeyValuePair, T>(
	db: AsyncTupleDatabaseClientApi<S>,
	fn: (db: ReadOnlyAsyncTupleDatabaseClientApi<S>) => Promise<T>,
	callback: (result: T) => void
): Promise<{ result: T; destroy: () => void }> {
	const listeners = new Set<any>()

	const compute = () => fn(listenDb)

	const resetListeners = () => {
		listeners.forEach((destroy) => destroy())
		listeners.clear()
	}

	// Use a queue to make sure we don't recompute at the same time.
	let lastComputedTxId: string | undefined
	const computeQueue: string[] = []
	const flushQueue = async () => {
		const txId = computeQueue.shift()
		if (txId === undefined) return

		// Skip over duplicate emits.
		if (txId === lastComputedTxId) return flushQueue()

		// Recompute.
		lastComputedTxId = txId
		resetListeners()
		const result = await compute()
		callback(result)

		// Keep recomputing til its empty.
		return flushQueue()
	}
	const recompute = async (txId: string) => {
		computeQueue.push(txId)
		return flushQueue()
	}

	// Subscribe for every scan that gets called.
	const listenDb = new AsyncTupleDatabaseClient<S>({
		scan: async (args: any, txId) => {
			if (txId)
				// Maybe one day we can transactionally subscribe to a bunch of things. But
				// for now, lets just avoid that...
				throw new Error("Not allowed to subscribe transactionally.")

			const destroy = await db.subscribe(args, async (_writes, txId) =>
				recompute(txId)
			)
			listeners.add(destroy)

			const results = await db.scan(args)
			return results
		},
		// This is ReadOnly...
		commit: throwError,
		cancel: throwError,
		subscribe: throwError,
		close: throwError,
	})

	const result = await compute()
	const destroy = resetListeners
	return { result, destroy }
}
