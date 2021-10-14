import { Transaction, TupleStorage } from "../storage/types"

// Accepts a transaction or a database and allows you to compose transactions together.
// Similar to FoundationDb's abstraction: https://apple.github.io/foundationdb/class-scheduling.html
export function transactional<I extends any[], O>(
	fn: (tx: Transaction, ...args: I) => O
) {
	return function (dbOrTx: TupleStorage | Transaction, ...args: I): O {
		return composeTx(dbOrTx, (tx) => fn(tx, ...args))
	}
}

export function composeTx<T>(
	dbOrTx: TupleStorage | Transaction,
	fn: (tx: Transaction) => T
) {
	if ("set" in dbOrTx) return fn(dbOrTx)
	const tx = dbOrTx.transact()
	const result = fn(tx)
	tx.commit()
	return result
}
