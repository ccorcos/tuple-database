/*

This file is generated from async/transactionalAsync.ts

*/

type Identity<T> = T

import { TupleValuePair } from "../../main"
import { TupleDatabaseClientApi, TupleTransactionApi } from "./types"

// Similar to FoundationDb's abstraction: https://apple.github.io/foundationdb/class-scheduling.html
// Accepts a transaction or a database and allows you to compose transactions together.

// This outer function is just used for the schema type because currying is the only way
// we can partially infer generic type parameters.
// https://stackoverflow.com/questions/60377365/typescript-infer-type-of-generic-after-optional-first-generic
export function transactionalQuery<
	S extends TupleValuePair = TupleValuePair
>() {
	return function <I extends any[], O>(
		fn: (tx: TupleTransactionApi<S>, ...args: I) => Identity<O>
	) {
		return function (
			dbOrTx: TupleDatabaseClientApi<S> | TupleTransactionApi<S>,
			...args: I
		): Identity<O> {
			if ("set" in dbOrTx) return fn(dbOrTx, ...args)
			const tx = dbOrTx.transact()
			const result = fn(tx, ...args)
			tx.commit()
			return result
		}
	}
}
