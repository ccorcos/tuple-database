/*

This file is generated from async/transactionalReadAsync.ts

*/

type Identity<T> = T

import { retry } from "./retry"
import {
	ReadOnlyTupleDatabaseClientApi,
	TupleDatabaseClientApi,
	TupleTransactionApi,
} from "./types"

/**
 * Similar to transactionalReadWrite and transactionalWrite but only allows reads.
 */
export function transactionalRead(retries = 5) {
	return function <I extends any[], O>(
		fn: (tx: ReadOnlyTupleDatabaseClientApi, ...args: I) => Identity<O>
	) {
		return function (
			dbOrTx:
				| TupleDatabaseClientApi
				| TupleTransactionApi
				| ReadOnlyTupleDatabaseClientApi,
			...args: I
		): Identity<O> {
			if (!("transact" in dbOrTx)) return fn(dbOrTx, ...args)
			return retry(retries, () => {
				const tx = dbOrTx.transact()
				const result = fn(tx, ...args)
				tx.commit()
				return result
			})
		}
	}
}
