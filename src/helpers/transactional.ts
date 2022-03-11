import {
	AsyncTupleDatabase,
	AsyncTupleTransaction,
} from "../storage/async/AsyncTupleDatabase"
import { TupleDatabase, TupleTransaction } from "../storage/sync/TupleDatabase"

// Accepts a transaction or a database and allows you to compose transactions together.
// Similar to FoundationDb's abstraction: https://apple.github.io/foundationdb/class-scheduling.html
export function transactional<I extends any[], O>(
	fn: (tx: TupleTransaction, ...args: I) => O
) {
	return function (dbOrTx: TupleDatabase | TupleTransaction, ...args: I): O {
		return composeTx(dbOrTx, (tx) => fn(tx, ...args))
	}
}

export function transactionalAsync<I extends any[], O>(
	fn: (tx: AsyncTupleTransaction, ...args: I) => Promise<O>
) {
	return async function (
		dbOrTx: AsyncTupleDatabase | AsyncTupleTransaction,
		...args: I
	): Promise<O> {
		return composeTxAsync(dbOrTx, (tx) => fn(tx, ...args))
	}
}

export function composeTx<T>(
	dbOrTx: TupleDatabase | TupleTransaction,
	fn: (tx: TupleTransaction) => T
) {
	if ("set" in dbOrTx) return fn(dbOrTx)
	const tx = dbOrTx.transact()
	const result = fn(tx)
	tx.commit()
	return result
}

export async function composeTxAsync<T>(
	dbOrTx: AsyncTupleDatabase | AsyncTupleTransaction,
	fn: (tx: AsyncTupleTransaction) => Promise<T>
) {
	if ("set" in dbOrTx) return fn(dbOrTx)
	const tx = dbOrTx.transact()
	const result = await fn(tx)
	await tx.commit()
	return result
}
