import { KeyValuePair } from "../../storage/types"
import {
	AsyncTupleDatabaseClientApi,
	AsyncTupleTransactionApi,
	ReadOnlyAsyncTupleDatabaseClientApi,
} from "./asyncTypes"
import { retryAsync } from "./retryAsync"

/**
 * Similar to transactionalReadWrite and transactionalWrite but only allows reads.
 */
export function transactionalReadAsync<S extends KeyValuePair = KeyValuePair>(
	retries = 5
) {
	return function <I extends any[], O>(
		fn: (tx: ReadOnlyAsyncTupleDatabaseClientApi<S>, ...args: I) => Promise<O>
	) {
		return async function (
			dbOrTx:
				| AsyncTupleDatabaseClientApi<S>
				| AsyncTupleTransactionApi<S>
				| ReadOnlyAsyncTupleDatabaseClientApi<S>,
			...args: I
		): Promise<O> {
			if (!("transact" in dbOrTx)) return fn(dbOrTx, ...args)
			return await retryAsync(retries, async () => {
				const tx = dbOrTx.transact()
				const result = await fn(tx, ...args)
				await tx.commit()
				return result
			})
		}
	}
}
