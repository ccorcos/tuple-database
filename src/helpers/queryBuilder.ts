/*

This is the current approach.
The main downside is writing all queries twice. Once for sync and once for async.

export const appendTriple = readWrite((tx, [e, a, v]: Triple) => {
	const nextOrder = getNextOrder(tx, [e, a])
	writeFact(tx, [e, a, nextOrder, v])
})

export const appendTripleAsync = readWriteAsync(
	async (tx, [e, a, v]: Triple) => {
		const nextOrder = await getNextOrderAsync(tx, [e, a])
		writeFact(tx, [e, a, nextOrder, v])
	}
)

export const getNextOrder = read((db, [e, a]: [string, string]) => {
	const lastOrder = db
		.subspace(["eaov", e, a])
		.scan({ reverse: true, limit: 1 })
		.map(({ key: [o, _v] }) => o)[0]

	const nextOrder = typeof lastOrder === "number" ? lastOrder + 1 : 0
	return nextOrder
})

export const getNextOrderAsync = readAsync(
	async (db, [e, a]: [string, string]) => {
		const results = await db
			.subspace(["eaov", e, a])
			.scan({ reverse: true, limit: 1 })
		const lastOrder = results.map(({ key: [o, _v] }) => o)[0]

		const nextOrder = typeof lastOrder === "number" ? lastOrder + 1 : 0
		return nextOrder
	}
)

export const writeFact = write((tx, fact: Fact) => {
	const [e, a, o, v] = fact
	tx.set(["eaov", e, a, o, v], null)
	tx.set(["aveo", a, v, e, o], null)
	tx.set(["veao", v, e, a, o], null)
})

*/

import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
} from "../database/typeHelpers"
import { ScanArgs, TupleDatabaseClientApi } from "../main"
import { KeyValuePair, WriteOps } from "../storage/types"

/*

Can we extract all of this query logic into a monad?


const getNextOrder =
	q.subspace(["eaov", e, a])
	 .scan({ reverse: true, limit: 1 })
	 .map(results => {
			const lastOrder = results.map(({ key: [o, _v] }) => o)[0]
			const nextOrder = typeof lastOrder === "number" ? lastOrder + 1 : 0
			return nextOrder
	 })

const writeFact = (fact: Fact) =>
	q.write((tx) => {
		const [e, a, o, v] = fact
		tx.set(["eaov", e, a, o, v], null)
		tx.set(["aveo", a, v, e, o], null)
		tx.set(["veao", v, e, a, o], null)
	})

const appendTriple = ([e, a, v]: Triple) =>
	getNextOrder
		.chain(nextOrder => {
			return writeFact([e, a, nextOrder, v])
		})

db.execute(appendTriple([id, "title", "Chet"]))


*/

export class QueryResult<T> {
	constructor(public ops: any[] = []) {}
	map = <O>(fn: (value: T) => O): QueryResult<O> => {
		return new QueryResult([...this.ops, { fn: "map", args: [fn] }])
	}
	chain = <O>(fn: (value: T) => QueryResult<O>): QueryResult<O> => {
		return new QueryResult([...this.ops, { fn: "chain", args: [fn] }])
	}
}

export class QueryBuilder<S extends KeyValuePair = KeyValuePair> {
	constructor(public ops: any[] = []) {}
	subspace = <P extends TuplePrefix<S["key"]>>(
		prefix: P
	): QueryBuilder<RemoveTupleValuePairPrefix<S, P>> => {
		return new QueryBuilder([...this.ops, { fn: "subspace", args: [prefix] }])
	}
	scan = <T extends S["key"], P extends TuplePrefix<T>>(
		args?: ScanArgs<T, P>
	): QueryResult<FilterTupleValuePairByPrefix<S, P>[]> => {
		return new QueryResult([...this.ops, { fn: "scan", args: [args] }])
	}
	write = (writes: WriteOps<S>): QueryResult<void> => {
		return new QueryResult([...this.ops, { fn: "write", args: [writes] }])
	}
}

export function execute<O, S extends KeyValuePair = KeyValuePair>(
	db: TupleDatabaseClientApi<S>,
	query: QueryResult<O>
): O {
	let tx: any = db
	if (!("set" in db)) {
		tx = db.transact()
	}

	let x: any = tx

	for (const op of query.ops) {
		if (op.fn === "subspace") {
			x = x.subspace(...op.args)
		}
		if (op.fn === "scan") {
			x = x.scan(...op.args)
		}
		if (op.fn === "map") {
			x = op.args[0](x)
		}
		if (op.fn === "chain") {
			x = execute(tx, op.args[0](x))
		}
		if (op.fn === "write") {
			x = x.write(...op.args)
		}
	}
	if (!("set" in db)) {
		tx.commit()
	}
	return x
}
