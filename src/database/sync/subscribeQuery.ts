/*

This file is generated from async/subscribeQueryAsync.ts

*/

type Identity<T> = T

import { KeyValuePair } from "../../storage/types"
import { TupleDatabaseClient } from "./TupleDatabaseClient"
import { ReadOnlyTupleDatabaseClientApi, TupleDatabaseClientApi } from "./types"

const throwError = () => {
	throw new Error()
}

export function subscribeQuery<S extends KeyValuePair, T>(
	db: TupleDatabaseClientApi<S>,
	fn: (db: ReadOnlyTupleDatabaseClientApi<S>) => Identity<T>,
	callback: (result: T) => void
): Identity<{ result: T; destroy: () => void }> {
	const listeners = new Set<any>()

	const compute = () => fn(listenDb)

	const resetListeners = () => {
		listeners.forEach((destroy) => destroy())
		listeners.clear()
	}

	// Use a queue to make sure we don't recompute at the same time.
	let lastComputedTxId: string | undefined
	const computeQueue: string[] = []
	const flushQueue = () => {
		const txId = computeQueue.shift()
		if (txId === undefined) return

		// Skip over duplicate emits.
		if (txId === lastComputedTxId) return flushQueue()

		// Recompute.
		lastComputedTxId = txId
		resetListeners()
		const result = compute()
		callback(result)

		// Keep recomputing til its empty.
		return flushQueue()
	}
	const recompute = (txId: string) => {
		computeQueue.push(txId)
		return flushQueue()
	}

	// Subscribe for every scan that gets called.
	const listenDb = new TupleDatabaseClient<S>({
		scan: (args: any, txId) => {
			if (txId)
				// Maybe one day we can transactionally subscribe to a bunch of things. But
				// for now, lets just avoid that...
				throw new Error("Not allowed to subscribe transactionally.")

			const destroy = db.subscribe(args, (_writes, txId) => recompute(txId))
			listeners.add(destroy)

			const results = db.scan(args)
			return results
		},
		// This is ReadOnly...
		commit: throwError,
		cancel: throwError,
		subscribe: throwError,
		close: throwError,
	})

	const result = compute()
	const destroy = resetListeners
	return { result, destroy }
}
