import { KeyValuePair, WriteOps } from "../storage/types"
import {
	AsyncTupleDatabaseClientApi,
	AsyncTupleTransactionApi,
} from "./async/asyncTypes"
import { retry } from "./sync/retry"
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
 * Similar to transactionalReadWrite and transactionalReadWriteAsync but only allows writes.
 */
export function transactionalWrite<S extends KeyValuePair = KeyValuePair>(
	retries = 5
) {
	return function <I extends any[], O>(
		fn: (tx: TransactionWriteApi<S>, ...args: I) => O
	) {
		return function (
			dbOrTx:
				| AsyncTupleDatabaseClientApi<S>
				| AsyncTupleTransactionApi<S>
				| TupleDatabaseClientApi<S>
				| TupleTransactionApi<S>
				| TransactionWriteApi<S>,
			...args: I
		): O {
			if ("set" in dbOrTx) return fn(dbOrTx, ...args)
			return retry(retries, () => {
				const tx = dbOrTx.transact()
				const result = fn(tx, ...args)
				tx.commit()
				return result
			})
		}
	}
}
