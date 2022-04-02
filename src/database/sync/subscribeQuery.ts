/*

This file is generated from async/subscribeQueryAsync.ts

*/

type Identity<T> = T

import { debounce } from "lodash"
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

	const recompute = debounce(
		() => {
			resetListeners()
			const result = compute()
			callback(result)
		},
		0,
		{ leading: true, trailing: false }
	)

	// Subscribe for every scan that gets called.
	const listenDb = new TupleDatabaseClient<S>({
		scan: (args: any, txId) => {
			if (txId) throwError()
			const destroy = db.subscribe(args, recompute)
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
