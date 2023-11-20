import { Tuple, Value, WriteOps } from "../storage/types"
import {
	AsyncTupleDatabaseClientApi,
	AsyncTupleTransactionApi,
} from "./async/asyncTypes"
import { retry } from "./sync/retry"
import { TupleDatabaseClientApi, TupleTransactionApi } from "./sync/types"
import { TuplePrefix } from "./typeHelpers"

export type TransactionWriteApi = {
	set: (tuple: Tuple, value: Value) => TransactionWriteApi
	remove: (tuple: Tuple) => TransactionWriteApi
	write: (writes: WriteOps) => TransactionWriteApi
	subspace: <P extends TuplePrefix<Tuple>>(prefix: P) => TransactionWriteApi
}

/**
 * Similar to transactionalReadWrite and transactionalReadWriteAsync but only allows writes.
 */
export function transactionalWrite(retries = 5) {
	return function <I extends any[], O>(
		fn: (tx: TransactionWriteApi, ...args: I) => O
	) {
		return function (
			dbOrTx:
				| AsyncTupleDatabaseClientApi
				| AsyncTupleTransactionApi
				| TupleDatabaseClientApi
				| TupleTransactionApi
				| TransactionWriteApi,
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
