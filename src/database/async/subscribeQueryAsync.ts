import { debounce } from "lodash"
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

	const recompute = debounce(
		async () => {
			resetListeners()
			const result = await compute()
			callback(result)
		},
		0,
		{ leading: true, trailing: false }
	)

	// Subscribe for every scan that gets called.
	const listenDb = new AsyncTupleDatabaseClient<S>({
		scan: async (args: any, txId) => {
			if (txId) throwError()
			const destroy = await db.subscribe(args, recompute)
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
