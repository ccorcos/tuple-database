import { strict as assert } from "assert"
import { after, describe, it } from "mocha"
import { AsyncTupleDatabaseClient } from "../database/async/AsyncTupleDatabaseClient"
import {
	AsyncTupleDatabaseClientApi,
	ReadOnlyAsyncTupleDatabaseClientApi,
} from "../database/async/asyncTypes"
import { transactionalQueryAsync } from "../database/async/transactionalQueryAsync"
import { transactionalQuery } from "../database/sync/transactionalQuery"
import { TupleDatabase } from "../database/sync/TupleDatabase"
import { TupleDatabaseClient } from "../database/sync/TupleDatabaseClient"
import {
	ReadOnlyTupleDatabaseClientApi,
	TupleDatabaseClientApi,
} from "../database/sync/types"
import { asyncThrottle } from "../helpers/asyncThrottle"
import { SchemaSubspace } from "../main"
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

async function getLogLengthAsync(
	db: ReadOnlyAsyncTupleDatabaseClientApi<LogSchema>
) {
	const [first] = await db.scan({ reverse: true, limit: 1 })
	return first !== undefined ? first.key[0] : 0
}

const appendLogAsync = transactionalQueryAsync<LogSchema>()(
	async (tx, value) => {
		const next = (await getLogLengthAsync(tx)) + 1
		tx.set([next], value)
	}
)

async function updateAsync(
	from: AsyncTupleDatabaseClientApi<LogSchema>,
	to: AsyncTupleDatabaseClientApi<LogSchema>,
	indexer: (tx, items: LogSchema[]) => void | Promise<void>
) {
	const currentLength = await getLogLengthAsync(to)
	const desiredLength = await getLogLengthAsync(from)
	if (currentLength === desiredLength) return
	if (currentLength > desiredLength) throw new Error("'to' ahead of 'from'.")

	const missing = desiredLength - currentLength
	const result = await from.scan({ reverse: true, limit: missing })
	result.reverse()

	const tx = to.transact()
	for (const item of result) {
		tx.set(item.key, item.value)
	}
	await indexer(tx, result)
	await tx.commit()
}

async function replicateAsync(
	from: AsyncTupleDatabaseClientApi<LogSchema>,
	to: AsyncTupleDatabaseClientApi<LogSchema>,
	indexer: (tx, items: LogSchema[]) => void | Promise<void>
) {
	const update = asyncThrottle(() => updateAsync(from, to, indexer))
	const unsubscribe = await from.subscribe({}, update)
	await update()
	return unsubscribe
}

describe("replicateAsync", () => {
	it("works", async () => {
		const from = new AsyncTupleDatabaseClient<LogSchema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		const to = new AsyncTupleDatabaseClient<LogSchema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		await appendLogAsync(from, "a")
		await appendLogAsync(from, "b")
		await appendLogAsync(from, "c")

		const r3 = [
			{ key: [1], value: "a" },
			{ key: [2], value: "b" },
			{ key: [3], value: "c" },
		]
		assert.deepEqual(await from.scan(), r3)
		assert.deepEqual(await to.scan(), [])

		after(await replicateAsync(from, to, () => {}))

		assert.deepEqual(await to.scan(), r3)

		await appendLogAsync(from, "d")

		const r4 = [
			{ key: [1], value: "a" },
			{ key: [2], value: "b" },
			{ key: [3], value: "c" },
			{ key: [4], value: "d" },
		]
		assert.deepEqual(await from.scan(), r4)
		assert.deepEqual(await to.scan(), r4)

		BATCH: {
			const tx = from.transact()
			await appendLogAsync(tx, "e")
			await appendLogAsync(tx, "f")
			await tx.commit()
		}

		const r6 = [
			{ key: [1], value: "a" },
			{ key: [2], value: "b" },
			{ key: [3], value: "c" },
			{ key: [4], value: "d" },
			{ key: [5], value: "e" },
			{ key: [6], value: "f" },
		]

		assert.deepEqual(await from.scan(), r6)
		assert.deepEqual(await to.scan(), r6)
	})

	it("can index on both sides", async () => {
		type Schema =
			| SchemaSubspace<["log"], LogSchema>
			| { key: ["total"]; value: string }

		const from = new AsyncTupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		const to = new AsyncTupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		const append = transactionalQueryAsync<Schema>()(
			async (tx, value: string) => {
				await appendLogAsync(tx.subspace(["log"]), value)

				const current = (await tx.get(["total"])) || ""
				tx.set(["total"], current + value)
			}
		)

		await append(from, "a")
		await append(from, "b")
		await append(from, "c")

		const r3 = [
			{ key: ["log", 1], value: "a" },
			{ key: ["log", 2], value: "b" },
			{ key: ["log", 3], value: "c" },
			{ key: ["total"], value: "abc" },
		]
		assert.deepEqual(await from.scan(), r3)
		assert.deepEqual(await to.scan(), [])

		after(
			await replicateAsync(
				from.subspace(["log"]),
				to.subspace(["log"]),
				async (tx, items) => {
					let total = (await tx.get(["total"])) || ""
					for (const item of items) {
						total += item.value
					}
					tx.set(["total"], total)
				}
			)
		)

		assert.deepEqual(await to.scan(), r3)

		await append(from, "d")

		const r4 = [
			{ key: ["log", 1], value: "a" },
			{ key: ["log", 2], value: "b" },
			{ key: ["log", 3], value: "c" },
			{ key: ["log", 4], value: "d" },
			{ key: ["total"], value: "abcd" },
		]
		assert.deepEqual(await from.scan(), r4)
		assert.deepEqual(await to.scan(), r4)

		BATCH: {
			const tx = from.transact()
			await append(tx, "e")
			await append(tx, "f")
			await tx.commit()
		}

		const r6 = [
			{ key: ["log", 1], value: "a" },
			{ key: ["log", 2], value: "b" },
			{ key: ["log", 3], value: "c" },
			{ key: ["log", 4], value: "d" },
			{ key: ["log", 5], value: "e" },
			{ key: ["log", 6], value: "f" },
			{ key: ["total"], value: "abcdef" },
		]

		assert.deepEqual(await from.scan(), r6)
		assert.deepEqual(await to.scan(), r6)
	})
})

/*

TODO:
- asyncThrottle tests

- how to run indexing on the other side after syncing?
	- handles throughput without tx conflict issues.


*/
