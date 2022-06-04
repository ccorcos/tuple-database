import { strict as assert } from "assert"
import { after, describe, it } from "mocha"
import { transactionalQuery } from "../database/sync/transactionalQuery"
import { TupleDatabase } from "../database/sync/TupleDatabase"
import { TupleDatabaseClient } from "../database/sync/TupleDatabaseClient"
import {
	ReadOnlyTupleDatabaseClientApi,
	TupleDatabaseClientApi,
} from "../database/sync/types"
import { InMemoryTupleStorage } from "../storage/InMemoryTupleStorage"

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

/*

TODO:
- async
- how to run indexing on the other side after syncing?

*/
