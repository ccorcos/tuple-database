import { Transaction, TupleStorage } from "../storage/types"

// Accepts a transaction or a database and allows you to compose transactions together.
// Similar to FoundationDb's abstraction: https://apple.github.io/foundationdb/class-scheduling.html
export function transactional<I extends any[], O>(
	fn: (tr: Transaction, ...args: I) => O
) {
	return function (dbOrTr: TupleStorage | Transaction, ...args: I): O {
		if ("set" in dbOrTr) return fn(dbOrTr, ...args)
		const tr = dbOrTr.transact()
		const result = fn(tr, ...args)
		tr.commit()
		return result
	}
}
