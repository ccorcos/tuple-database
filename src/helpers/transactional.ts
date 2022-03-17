// Accepts a transaction or a database and allows you to compose transactions together.

import {
	AsyncTupleDatabaseDialectApi,
	AsyncTupleTransactionApi,
} from "../storage/async/asyncTypes"
import {
	TupleDatabaseDialectApi,
	TupleTransactionApi,
} from "../storage/sync/types"

// Similar to FoundationDb's abstraction: https://apple.github.io/foundationdb/class-scheduling.html
export function transactional<I extends any[], O>(
	fn: (tx: TupleTransactionApi, ...args: I) => O
) {
	return function (
		dbOrTx: TupleDatabaseDialectApi | TupleTransactionApi,
		...args: I
	): O {
		return composeTx(dbOrTx, (tx) => fn(tx, ...args))
	}
}

export function transactionalAsync<I extends any[], O>(
	fn: (tx: AsyncTupleTransactionApi, ...args: I) => Promise<O>
) {
	return async function (
		dbOrTx: AsyncTupleDatabaseDialectApi | AsyncTupleTransactionApi,
		...args: I
	): Promise<O> {
		return composeTxAsync(dbOrTx, (tx) => fn(tx, ...args))
	}
}

function composeTx<T>(
	dbOrTx: TupleDatabaseDialectApi | TupleTransactionApi,
	fn: (tx: TupleTransactionApi) => T
) {
	if ("set" in dbOrTx) return fn(dbOrTx)
	const tx = dbOrTx.transact()
	const result = fn(tx)
	tx.commit()
	return result
}

async function composeTxAsync<T>(
	dbOrTx: AsyncTupleDatabaseDialectApi | AsyncTupleTransactionApi,
	fn: (tx: AsyncTupleTransactionApi) => Promise<T>
) {
	if ("set" in dbOrTx) return fn(dbOrTx)
	const tx = dbOrTx.transact()
	const result = await fn(tx)
	await tx.commit()
	return result
}
