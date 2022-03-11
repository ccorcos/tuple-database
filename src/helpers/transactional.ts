import { TupleDatabase, TupleTransaction } from "../storage/TupleDatabase"

// Accepts a transaction or a database and allows you to compose transactions together.
// Similar to FoundationDb's abstraction: https://apple.github.io/foundationdb/class-scheduling.html
export function transactional<I extends any[], O>(
	fn: (tx: TupleTransaction, ...args: I) => O
) {
	return function (dbOrTx: TupleDatabase | TupleTransaction, ...args: I): O {
		return composeTx(dbOrTx, (tx) => fn(tx, ...args))
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
