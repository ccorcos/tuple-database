import { strict as assert } from "assert"
import { after, describe, it } from "mocha"
import { AsyncTupleDatabaseClient } from "../database/async/AsyncTupleDatabaseClient"
import {
	AsyncTupleDatabaseApi,
	AsyncTupleDatabaseClientApi,
	ReadOnlyAsyncTupleDatabaseClientApi,
} from "../database/async/asyncTypes"
import { transactionalQueryAsync } from "../database/async/transactionalQueryAsync"
import { TupleDatabase } from "../database/sync/TupleDatabase"
import { SchemaSubspace } from "../database/typeHelpers"
import { ScanArgs } from "../database/types"
import { asyncThrottle } from "../helpers/asyncThrottle"
import { InMemoryTupleStorage } from "../storage/InMemoryTupleStorage"

type LogSchema = { key: [number]; value: any }

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

const updateLogAsync = transactionalQueryAsync<LogSchema>()(
	async (tx, from: AsyncTupleDatabaseClientApi<LogSchema>) => {
		const currentLength = await getLogLengthAsync(tx)

		const desiredLength = await getLogLengthAsync(from)
		if (currentLength === desiredLength) return
		if (currentLength > desiredLength) throw new Error("'to' ahead of 'from'.")

		const missing = desiredLength - currentLength
		const result = await from.scan({ reverse: true, limit: missing })
		result.reverse()

		await tx.write({ set: result })
	}
)

async function replicateAsync(
	from: AsyncTupleDatabaseClientApi<LogSchema>,
	to: AsyncTupleDatabaseClientApi<LogSchema>
) {
	const update = asyncThrottle(() => updateLogAsync(to, from))
	const unsubscribe = await from.subscribe({}, update)
	await update()
	return unsubscribe
}

// function tupleStartsWith(tuple: Tuple, prefix: Tuple) {
// 	for (let i = 0; i < prefix.length; i++) {
// 		if (compareValue(tuple[i], prefix[i]) !== 0) return false
// 	}
// 	return true
// }

// function validateScanPrefix(args: ScanStorageArgs | undefined, prefix: Tuple) {
// 	if (args === undefined) {
// 		if (prefix.length === 0) return true
// 		else return false
// 	}
// 	if (args.gt && !tupleStartsWith(args.gt, prefix)) return false
// 	if (args.gte && !tupleStartsWith(args.gte, prefix)) return false
// 	if (args.lt && !tupleStartsWith(args.lt, prefix)) return false
// 	if (args.lte && !tupleStartsWith(args.lte, prefix)) return false
// 	return true
// }

// function validateWritePrefix(writes: WriteOps, prefix: Tuple) {
// 	for (const { key } of writes.set || []) {
// 		if (!tupleStartsWith(key, prefix)) return false
// 	}
// 	for (const key of writes.remove || []) {
// 		if (!tupleStartsWith(key, prefix)) return false
// 	}
// 	return true
// }

function exposeReplicateAsync2(
	db: AsyncTupleDatabaseClientApi<LogSchema>,
	append: (value: any, txId: string) => void | Promise<void>
): AsyncTupleDatabaseApi {
	const api: AsyncTupleDatabaseApi = {
		scan: async (args = {}, txId) => {
			// TODO: validate that they're only reading the last log item.
			// TODO: improvement - only need to get the last log item key. maybe just make it "head" key.
			return db.scan(args as ScanArgs<LogSchema["key"]>, txId)
		},
		commit: async (writes, txId) => {
			// No need to validate prefix because db is already in the log subspace.
			// TODO: validate that people aren't dumping arbitrary shit in here.

			if (writes.remove?.length)
				throw new Error("Not allowed to delete from the append-only log.")

			// Close out the transaction so that we resolve any concurrency conflicts.
			// But we're going to append each item one at a time so that we don't
			// have to retry across the network when there's a conflict on just a
			// single item when it is getting indexed...
			await db.commit({}, txId)

			// TODO: validate logs in order, etc.
			const items = (writes.set || []) as LogSchema[]

			const appendItem = transactionalQueryAsync<LogSchema>()(
				async (tx, { key, value }: LogSchema) => {
					const index = key[0]
					const currentLength = await getLogLengthAsync(tx)
					if (index <= currentLength) return
					if (index !== currentLength + 1)
						throw new Error("Missing log item: " + currentLength + 1)

					await append(value, tx.id)
				}
			)

			for (const item of items) {
				await appendItem(db, item)
			}
		},
		cancel: async (txId) => {
			return db.cancel(txId)
		},
		subscribe: async (args, callback) => {
			throw new Error("Not allowed to subscribe.")
		},
		close: async () => {
			throw new Error("Not allowed to close.")
		},
	}
	return api
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

		after(await replicateAsync(from, to))

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

		// On machine A
		const from = new AsyncTupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		// On machine B
		const remote = new AsyncTupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		const toApi = exposeReplicateAsync2(
			remote.subspace(["log"]),
			async (items, txId) => {
				// Suppose someone is incrementing their score at the same time
				// that this log is synced. We'd get a conflict.
				const tx = remote.transact(txId)
				// TODO: assert that these items are in order and "next"

				for (const item of items) {
					await append(tx, item.value)
				}
				await tx.commit()
			}
		)

		// On machine A again...
		const to = new AsyncTupleDatabaseClient<LogSchema>(toApi)

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

		after(await replicateAsync(from.subspace(["log"]), to))

		assert.deepEqual(await remote.scan(), r3)

		await append(from, "d")

		const r4 = [
			{ key: ["log", 1], value: "a" },
			{ key: ["log", 2], value: "b" },
			{ key: ["log", 3], value: "c" },
			{ key: ["log", 4], value: "d" },
			{ key: ["total"], value: "abcd" },
		]
		assert.deepEqual(await from.scan(), r4)
		assert.deepEqual(await remote.scan(), r4)

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
		assert.deepEqual(await remote.scan(), r6)
	})
})
