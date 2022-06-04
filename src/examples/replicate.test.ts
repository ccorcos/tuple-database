import { strict as assert } from "assert"
import { after, describe, it } from "mocha"
import { compareTuple } from "../helpers/compareTuple"
import {
	InMemoryTupleStorage,
	ReadOnlyTupleDatabaseClientApi,
	transactionalQuery,
	TupleDatabase,
	TupleDatabaseClient,
	TupleDatabaseClientApi,
} from "../main"
import { Fact, Value } from "./triplestore"

// We're going to build off of the triplestore example.
// So read triplestore.ts and triplestore.test.ts first.

type Obj = { id: string; [key: string]: Value | Value[] }

// Represent objects that we're typically used to as triples.
function objectToFacts(obj: Obj) {
	const facts: Fact[] = []
	const { id, ...rest } = obj
	for (const [key, value] of Object.entries(rest)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				facts.push([id, key, item])
			}
		} else {
			facts.push([id, key, value])
		}
	}
	facts.sort(compareTuple)
	return facts
}

objectToFacts({
	id: "1",
	name: "Chet",
	age: 31,
	tags: ["engineer", "musician"],
})

// const writeObjectFact = transactionalQuery<Schema>()((tx, fact: Fact) => {
// 	writeFact(tx.subspace(["data"]), fact)
// 	reindexFact(tx, fact)
// })

// const writeObject = transactionalQuery<Schema>()((tx, obj: Obj) => {
// 	for (const fact of objectToFacts(obj)) {
// 		writeObjectFact(tx, fact)
// 	}
// })

type LogSchema = { key: [number]; value: any }

function getLogLength(db: ReadOnlyTupleDatabaseClientApi<LogSchema>) {
	const [first] = db.scan({ reverse: true, limit: 1 })
	return first !== undefined ? first.key[0] : 0
}

const appendLog = transactionalQuery<LogSchema>()((tx, value) => {
	const next = getLogLength(tx) + 1
	tx.set([next], value)
})

function update(
	from: TupleDatabaseClientApi<LogSchema>,
	to: TupleDatabaseClientApi<LogSchema>
) {
	const currentLength = getLogLength(to)
	const desiredLength = getLogLength(from)
	if (currentLength === desiredLength) return
	if (currentLength > desiredLength) throw new Error("'to' ahead of 'from'.")

	const missing = desiredLength - currentLength
	const result = from.scan({ reverse: true, limit: missing })
	to.commit({ set: result })
}

function replicate(
	from: TupleDatabaseClientApi<LogSchema>,
	to: TupleDatabaseClientApi<LogSchema>
) {
	update(from, to)
	const unsubscribe = from.subscribe({}, () => update(from, to))
	return unsubscribe
}

describe("replicate", () => {
	it("works", () => {
		const from = new TupleDatabaseClient<LogSchema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		const to = new TupleDatabaseClient<LogSchema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		appendLog(from, "a")
		appendLog(from, "b")
		appendLog(from, "c")

		const r3 = [
			{ key: [1], value: "a" },
			{ key: [2], value: "b" },
			{ key: [3], value: "c" },
		]
		assert.deepEqual(from.scan(), r3)
		assert.deepEqual(to.scan(), [])

		after(replicate(from, to))

		assert.deepEqual(to.scan(), r3)

		appendLog(from, "d")

		const r4 = [
			{ key: [1], value: "a" },
			{ key: [2], value: "b" },
			{ key: [3], value: "c" },
			{ key: [4], value: "d" },
		]
		assert.deepEqual(from.scan(), r4)
		assert.deepEqual(to.scan(), r4)

		BATCH: {
			const tx = from.transact()
			appendLog(tx, "e")
			appendLog(tx, "f")
			tx.commit()
		}

		const r6 = [
			{ key: [1], value: "a" },
			{ key: [2], value: "b" },
			{ key: [3], value: "c" },
			{ key: [4], value: "d" },
			{ key: [5], value: "e" },
			{ key: [6], value: "f" },
		]

		assert.deepEqual(from.scan(), r6)
		assert.deepEqual(to.scan(), r6)
	})
})
