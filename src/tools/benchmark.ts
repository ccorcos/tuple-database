/*

	./node_modules/.bin/ts-node src/tools/benchmark.ts

*/

import sqlite from "better-sqlite3"
import * as fs from "fs-extra"
import level from "level"
import { range } from "lodash"
import * as path from "path"
import {
	AsyncTupleDatabaseDialect,
	InMemoryTupleStorage,
	transactionalAsync,
} from "../main"
import { AsyncTupleDatabase } from "../storage/async/AsyncTupleDatabase"
import { AsyncTupleDatabaseDialectApi } from "../storage/async/asyncTypes"
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

const initialDatabaseSize = 10000

const initialize = transactionalAsync(async (tx) => {
	for (const i of range(initialDatabaseSize)) {
		tx.set(randomTuple(), null)
	}
})

const readRemoveWrite = transactionalAsync(async (tx) => {
	for (const i of range(readIters)) {
		const results = await tx.scan({ gt: randomTuple(), limit: 10 })
		for (const [tuple] of results) {
			tx.remove(tuple)
		}
	}
	for (const i of range(writeIters)) {
		tx.set(randomTuple(), null)
	}
})

async function timeIt(label: string, fn: () => Promise<void>) {
	const start = performance.now()
	await fn()
	const end = performance.now()
	console.log(label, end - start)
}

async function asyncBenchmark(label: string, db: AsyncTupleDatabaseDialectApi) {
	await timeIt(label + ":initialize", () => initialize(db))

	await timeIt(label + ":readRemoveWrite", async () => {
		for (const i of range(iterations)) {
			await readRemoveWrite(db)
		}
	})
}

const tmpDir = path.resolve(__dirname, "../../tmp")

async function main() {
	await fs.mkdirp(tmpDir)

	await asyncBenchmark(
		"AsyncTupleDatabase(InMemoryTupleStorage))",
		new AsyncTupleDatabaseDialect(
			new AsyncTupleDatabase(new InMemoryTupleStorage())
		)
	)

	await asyncBenchmark(
		"AsyncTupleDatabase(SQLiteTupleStorage))",
		new AsyncTupleDatabaseDialect(
			new AsyncTupleDatabase(
				new SQLiteTupleStorage(sqlite(path.join(tmpDir, "benchmark-sqlite.db")))
			)
		)
	)

	await asyncBenchmark(
		"AsyncTupleDatabase(LevelTupleStorage))",
		new AsyncTupleDatabaseDialect(
			new AsyncTupleDatabase(
				new LevelTupleStorage(level(path.join(tmpDir, "benchmark-level.db")))
			)
		)
	)
}

main()
