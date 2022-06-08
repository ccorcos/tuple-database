import { strict as assert } from "assert"
import { after, describe, it } from "mocha"
import { AsyncTupleDatabaseClient } from "../database/async/AsyncTupleDatabaseClient"
import {
	AsyncTupleDatabaseClientApi,
	AsyncTupleTransactionApi,
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
import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	SchemaSubspace,
	TuplePrefix,
} from "../database/typeHelpers"
import { TxId } from "../database/types"
import { asyncThrottle } from "../helpers/asyncThrottle"
import { compareValue } from "../helpers/compareTuple"
import { InMemoryTupleStorage } from "../storage/InMemoryTupleStorage"
import {
	KeyValuePair,
	ScanStorageArgs,
	Tuple,
	WriteOps,
} from "../storage/types"

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
	to: AsyncTupleDatabaseClientApi<LogSchema>
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
	await tx.commit()
}

async function replicateAsync(
	from: AsyncTupleDatabaseClientApi<LogSchema>,
	to: AsyncTupleDatabaseClientApi<LogSchema>
) {
	const update = asyncThrottle(() => updateAsync(from, to))
	const unsubscribe = await from.subscribe({}, update)
	await update()
	return unsubscribe
}

// What features do we need to make this easier?
// - client.expose(subspace, indexer)

function tupleStartsWith(tuple: Tuple, prefix: Tuple) {
	for (let i = 0; i < prefix.length; i++) {
		if (compareValue(tuple[i], prefix[i]) !== 0) return false
	}
	return true
}

function validateScanPrefix(args: ScanStorageArgs | undefined, prefix: Tuple) {
	if (args === undefined) {
		if (prefix.length === 0) return true
		else return false
	}
	if (args.gt && !tupleStartsWith(args.gt, prefix)) return false
	if (args.gte && !tupleStartsWith(args.gte, prefix)) return false
	if (args.lt && !tupleStartsWith(args.lt, prefix)) return false
	if (args.lte && !tupleStartsWith(args.lte, prefix)) return false
	return true
}

function validateWritePrefix(writes: WriteOps, prefix: Tuple) {
	for (const { key } of writes.set || []) {
		if (!tupleStartsWith(key, prefix)) return false
	}
	for (const key of writes.remove || []) {
		if (!tupleStartsWith(key, prefix)) return false
	}
	return true
}

function exposeAsync<S extends KeyValuePair, P extends TuplePrefix<S["key"]>>(
	db: AsyncTupleDatabaseClientApi<S>,
	prefix: P,
	indexer?: (
		tx: AsyncTupleTransactionApi<S>,
		writes: WriteOps<FilterTupleValuePairByPrefix<S, P>>
	) => Error | void | Promise<Error | void>
): AsyncTupleDatabaseClientApi<RemoveTupleValuePairPrefix<S, P>> {
	const db2 = new AsyncTupleDatabaseClient<S>({
		scan: (args?: ScanStorageArgs, txId?: TxId) => {
			if (!validateScanPrefix(args, prefix)) {
				throw new Error("Not allowed to scan beyond prefix range.")
			}
			return db.scan(args as any, txId)
		},
		commit: async (writes: WriteOps, txId?: TxId) => {
			if (!validateWritePrefix(writes, prefix)) {
				throw new Error("Not allowed to write beyond prefix range.")
			}

			const tx = db.transact(txId, writes as WriteOps<S>)
			if (indexer) {
				const error = await indexer(tx, writes as any)
				if (error) {
					await tx.cancel()
					throw error
				}
			}
			await tx.commit()
		},
		cancel: db.cancel,
		subscribe: () => {
			throw new Error("No subscribing, only replicating to.")
		},
		close: () => {
			throw new Error("Not sure what to do here yet.")
		},
	})

	return db2.subspace(prefix)
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

		const from = new AsyncTupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		const remote = new AsyncTupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		const to = exposeAsync<Schema, ["log"]>(
			remote,
			["log"],
			async (tx, writes) => {
				if (writes.remove?.length)
					throw new Error("Not allowed to delete from the append-only log.")

				let total: string = (await tx.get(["total"])) || ""
				for (const { value } of writes.set || []) {
					total += value
				}

				tx.set(["total"], total)
			}
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
