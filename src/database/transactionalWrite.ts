import { retry } from "../helpers/retry"
import { KeyValuePair, WriteOps } from "../storage/types"
import {
	AsyncTupleDatabaseClientApi,
	AsyncTupleTransactionApi,
} from "./async/asyncTypes"
import { TupleDatabaseClientApi, TupleTransactionApi } from "./sync/types"

type TransactionWriteApi<S extends KeyValuePair> = {
	set: <T extends S>(
		tuple: T["key"],
		value: T["value"]
	) => TransactionWriteApi<S>
	remove: (tuple: S["key"]) => TransactionWriteApi<S>
	write: (writes: WriteOps<S>) => TransactionWriteApi<S>
}

/**
 * Similar to transactionalQuery and transactionalQueryAsync but only allows writes.
 */
export function transactionalWrite<S extends KeyValuePair = KeyValuePair>(
	retries = 5
) {
	return function <I extends any[], O>(
		fn: (tx: TransactionWriteApi<S>, ...args: I) => Promise<O>
	) {
		return async function (
			dbOrTx:
				| AsyncTupleDatabaseClientApi<S>
				| AsyncTupleTransactionApi<S>
				| TupleDatabaseClientApi<S>
				| TupleTransactionApi<S>,
			...args: I
		): Promise<O> {
			if ("set" in dbOrTx) return fn(dbOrTx, ...args)
			return await retry(retries, async () => {
				const tx = dbOrTx.transact()
				const result = await fn(tx, ...args)
				await tx.commit()
				return result
			})
		}
	}
}
