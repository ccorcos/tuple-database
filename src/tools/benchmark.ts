/*

	./node_modules/.bin/ts-node src/tools/benchmark.ts

*/

import sqlite from "better-sqlite3"
import * as fs from "fs-extra"
import { Level } from "level"
import { range } from "lodash"
import * as path from "path"
import { AsyncTupleDatabase } from "../database/async/AsyncTupleDatabase"
import { AsyncTupleDatabaseClientApi } from "../database/async/asyncTypes"
import { transactionalReadWriteAsync } from "../database/async/transactionalReadWriteAsync"
import { AsyncTupleDatabaseClient, InMemoryTupleStorage } from "../main"
import { LevelTupleStorage } from "../storage/LevelTupleStorage"
import { SQLiteTupleStorage } from "../storage/SQLiteTupleStorage"

const iterations = 1000
const writeIters = 100
const readSize = 10
const readIters = writeIters / readSize
const tupleSize = 4

function randomTuple() {
	return range(tupleSize).map(() => Math.random())
}

function randomObjectTuple() {
	return range(tupleSize).map(() => ({ value: Math.random() }))
}

function randomArrayTuple() {
	return range(tupleSize).map(() => [Math.random(), Math.random()])
}

const initialDatabaseSize = 10000

const seedReadRemoveWriteBench = transactionalReadWriteAsync()(async (tx) => {
	for (const i of range(initialDatabaseSize)) {
		tx.set(randomTuple(), null)
	}
})

const readRemoveWrite = transactionalReadWriteAsync()(async (tx) => {
	for (const i of range(readIters)) {
		const results = await tx.scan({ gt: randomTuple(), limit: 10 })
		for (const { key } of results) {
			tx.remove(key)
		}
	}
	for (const i of range(writeIters)) {
		tx.set(randomTuple(), null)
	}
})

const seedReadPerformanceBench = transactionalReadWriteAsync()(async (tx) => {
	// seed simple tuples
	for (const i of range(initialDatabaseSize)) {
		tx.set(["simpleTuple", ...randomTuple()], null)
	}
	// seed complex tuples
	for (const i of range(initialDatabaseSize)) {
		tx.set(["objectTuple", ...randomObjectTuple()], null)
	}

	// seed complex tuples
	for (const i of range(initialDatabaseSize)) {
		tx.set(["arrayTuple", ...randomArrayTuple()], null)
	}
})

const readSimpleTuples = transactionalReadWriteAsync()(async (tx) => {
	await tx.scan({ prefix: ["simpleTuple"], gte: [0], lt: [1] })
})

const readObjectTuples = transactionalReadWriteAsync()(async (tx) => {
	await tx.scan({
		prefix: ["objectTuple"],
		gte: [{ value: 0 }],
		lt: [{ value: 1 }],
	})
})

const readArrayTuples = transactionalReadWriteAsync()(async (tx) => {
	await tx.scan({
		prefix: ["arrayTuple"],
		gte: [[0, 0]],
		lt: [[1, 1]],
	})
})

async function timeIt(label: string, fn: () => Promise<void>) {
	const start = performance.now()
	await fn()
	const end = performance.now()
	console.log(label, end - start)
}

async function asyncReadRemoveWriteBenchmark(
	label: string,
	db: AsyncTupleDatabaseClientApi
) {
	await timeIt(label + ":seedReadRemoveWriteBench", () =>
		seedReadRemoveWriteBench(db)
	)

	await timeIt(label + ":readRemoveWrite", async () => {
		for (const i of range(iterations)) {
			await readRemoveWrite(db)
		}
	})
}

async function asyncReadPerformanceBenchmark(
	label: string,
	db: AsyncTupleDatabaseClientApi
) {
	await timeIt(label + ":seedReadPerformanceBench", () =>
		seedReadPerformanceBench(db)
	)

	await timeIt(label + ":readSimpleTuples", async () => {
		for (const i of range(iterations)) {
			await readSimpleTuples(db)
		}
	})

	await timeIt(label + ":readObjectTuples", async () => {
		for (const i of range(iterations)) {
			await readObjectTuples(db)
		}
	})

	await timeIt(label + ":readArrayTuples", async () => {
		for (const i of range(iterations)) {
			await readArrayTuples(db)
		}
	})
}

const tmpDir = path.resolve(__dirname, "../../tmp")

async function main() {
	await fs.mkdirp(tmpDir)

	await asyncReadRemoveWriteBenchmark(
		"AsyncTupleDatabase(InMemoryTupleStorage))",
		new AsyncTupleDatabaseClient(
			new AsyncTupleDatabase(new InMemoryTupleStorage())
		)
	)

	await asyncReadPerformanceBenchmark(
		"AsyncTupleDatabase(InMemoryTupleStorage))",
		new AsyncTupleDatabaseClient(
			new AsyncTupleDatabase(new InMemoryTupleStorage())
		)
	)

	await asyncReadRemoveWriteBenchmark(
		"AsyncTupleDatabase(SQLiteTupleStorage))",
		new AsyncTupleDatabaseClient(
			new AsyncTupleDatabase(
				new SQLiteTupleStorage(sqlite(path.join(tmpDir, "benchmark-sqlite.db")))
			)
		)
	)

	await asyncReadRemoveWriteBenchmark(
		"AsyncTupleDatabase(LevelTupleStorage))",
		new AsyncTupleDatabaseClient(
			new AsyncTupleDatabase(
				new LevelTupleStorage(
					new Level(path.join(tmpDir, "benchmark-level.db"))
				)
			)
		)
	)
}

main()
