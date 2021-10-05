// Based on FoundationDb tutorial: https://apple.github.io/foundationdb/class-scheduling.html

import { InMemoryStorage } from "../storage/InMemoryStorage"
import { MAX, MIN, Storage, Transaction, Tuple } from "../storage/types"

const db = new InMemoryStorage()

// Similar to FoundationDb's abstraction.
// https://github.com/apple/foundationdb/blob/dc3cebe8d904a704f734524943fc074dbaa59efc/bindings/python/fdb/subspace_impl.py
class Subspace {
	public prefix: Tuple
	constructor(...prefix: Tuple) {
		this.prefix = prefix
	}
	pack(rest: Tuple) {
		return [...this.prefix, ...rest]
	}
	unpack(tuple: Tuple) {
		return tuple.slice(this.prefix.length)
	}
	subspace(...more: Tuple) {
		return new Subspace(...this.pack(more))
	}
	range() {
		return {
			start: this.pack([MIN]),
			stop: this.pack([MAX]),
		}
	}
	// contains(tuple: Tuple): boolean
}

// Accepts a transaction or a database and allows you to compose transactions together
function transactional<I extends any[], O>(
	fn: (tr: Transaction, ...args: I) => O
) {
	return function (dbOrTr: Storage | Transaction, ...args: I): O {
		if ("commit" in dbOrTr) return fn(dbOrTr, ...args)
		const tr = dbOrTr.transact()
		const result = fn(tr, ...args)
		tr.commit()
		return result
	}
}

const scheduling = new Subspace("scheduling")
const course = scheduling.subspace("class")
const attends = scheduling.subspace("attends")

const addClass = transactional((tr, className: string, maxAttend: number) => {
	tr.set(course.pack([className]))
})
// // @fdb.transactional
// // def add_class(tr, c):
// //     tr[course.pack((c,))] = fdb.tuple.pack((100,))
