/*

This file is generated from async/subscribeQueryAsync.ts

*/

type Identity<T> = T

import { KeyValuePair } from "../../storage/types"
import { TxId } from "../types"
import { TupleDatabaseClient } from "./TupleDatabaseClient"
import { ReadOnlyTupleDatabaseClientApi, TupleDatabaseClientApi } from "./types"

const throwError = () => {
	throw new Error()
}

class Queue<T> {
	private items: T[] = []

	constructor(private dequeue: (item: T) => Identity<void>) {}

	private flushing: Identity<void> | undefined

	private attemptFlush() {
		if (!this.flushing) this.flushing = this.flush()
		return this.flushing
	}

	private flush() {
		while (this.items.length > 0) {
			const item = this.items.shift()!
			this.dequeue(item)
		}
		this.flushing = undefined
	}

	public enqueue(item: T) {
		this.items.push(item)
		this.attemptFlush()
	}
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

	let lastComputedTxId: string | undefined
	const recomputeQueue = new Queue<TxId>((txId) => {
		// Skip over duplicate emits.
		if (txId === lastComputedTxId) return

		// Recompute.
		lastComputedTxId = txId
		resetListeners()
		const result = compute()
		callback(result)
	})

	// Subscribe for every scan that gets called.
	const listenDb = new TupleDatabaseClient<S>({
		scan: (args: any, txId) => {
			if (txId)
				// Maybe one day we can transactionally subscribe to a bunch of things. But
				// for now, lets just avoid that...
				throw new Error("Not allowed to subscribe transactionally.")

			const destroy = db.subscribe(args, (_writes, txId) =>
				recomputeQueue.enqueue(txId)
			)
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
