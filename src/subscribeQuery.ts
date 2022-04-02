// import { debounce } from "lodash"
// import {
// 	KeyValuePair,
// 	ReadOnlyTupleDatabaseClientApi,
// 	TupleDatabaseClient,
// 	TupleDatabaseClientApi,
// } from "./main"

// const throwError = () => {
// 	throw new Error()
// }

// export function subscribeQuery<S extends KeyValuePair, T>(
// 	db: TupleDatabaseClientApi<S>,
// 	fn: (db: ReadOnlyTupleDatabaseClientApi<S>) => T,
// 	callback: (result: T) => void
// ): { result: T; destroy: () => void } {
// 	const listeners = new Set<any>()

// 	const compute = () => fn(listenDb)

// 	const resetListeners = () => {
// 		listeners.forEach((destroy) => destroy())
// 		listeners.clear()
// 	}

// 	const recompute = debounce(
// 		() => {
// 			resetListeners()
// 			callback(compute())
// 		},
// 		0,
// 		{ leading: true, trailing: false }
// 	)

// 	// Subscribe for every scan that gets called.
// 	const listenDb = new TupleDatabaseClient<S>({
// 		scan: (args: any, txId) => {
// 			if (txId) throwError()

// 			const results = db.scan(args)

// 			const destroy = db.subscribe(args, recompute)
// 			listeners.add(destroy)

// 			return results
// 		},
// 		// This is ReadOnly...
// 		commit: throwError,
// 		cancel: throwError,
// 		subscribe: throwError,
// 		close: throwError,
// 	})

// 	const result = compute()
// 	const destroy = resetListeners
// 	return { result, destroy }
// }
