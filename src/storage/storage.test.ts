/*

	Storage Tests.
	./node_modules/.bin/mocha -r ts-node/register ./src/storage/storage.test.ts

*/

import { strict as assert } from "assert"
import sqlite from "better-sqlite3"
import * as _ from "lodash"
import { describe, it } from "mocha"
import { randomId } from "../helpers/randomId"
import { sortedValues } from "../test/fixtures"
import { FileStorage } from "./FileStorage"
import { InMemoryStorage } from "./InMemoryStorage"
import { SQLiteStorage } from "./SQLiteStorage"
import { MAX, MIN, Storage, Tuple, TupleValuePair } from "./types"

function storageTestSuite(
	name: string,
	sortedValues: Tuple,
	createStorage: (id: string) => Storage,
	durable = true
) {
	describe(name, () => {
		it("inserts in correct order", () => {
			const store = createStorage(randomId())
			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)
		})

		it("inserts the same thing gets deduplicated", () => {
			const store = createStorage(randomId())
			const transaction = store.transact()
			transaction.set(["a", "a"], 0)
			transaction.set(["a", "a"], 0)
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, [[["a", "a"], 0]])
		})

		it("updates will overwrite the value", () => {
			const store = createStorage(randomId())
			const transaction = store.transact()
			transaction.set(["a", "a"], 0)
			transaction.set(["a", "a"], 1)
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, [[["a", "a"], 1]])
		})

		it("transaction value overwrites works", () => {
			const store = createStorage(randomId())
			const transaction = store.transact()
			transaction.set(["a", "a"], 0)
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, [[["a", "a"], 0]])

			const transaction2 = store.transact()
			transaction2.set(["a", "a"], 1)
			const data2 = transaction2.scan()
			assert.deepEqual(data2, [[["a", "a"], 1]])

			transaction2.commit()
			const data3 = store.scan()
			assert.deepEqual(data3, [[["a", "a"], 1]])
		})

		it("inserts the same thing gets deduplicated with ids", () => {
			const store = createStorage(randomId())
			store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.set(["a", { uuid: "a" }], 0)
				.commit()
			const data = store.scan()
			assert.deepEqual(data.length, 1)
		})

		it("inserts get deduplicated in separate transactions", () => {
			const store = createStorage(randomId())

			store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.commit()

			store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.commit()

			const data = store.scan()
			assert.deepEqual(data.length, 1)
		})

		it("inserts get deduplicated set/remove in same transaction", () => {
			const store = createStorage(randomId())

			store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.remove(["a", { uuid: "a" }])
				.commit()

			const data = store.scan()
			assert.deepEqual(data.length, 0, `data: ${JSON.stringify(data)}`)
		})

		it("inserts get deduplicated remove/set in same transaction", () => {
			const store = createStorage(randomId())

			store
				.transact()
				.remove(["a", { uuid: "a" }])
				.set(["a", { uuid: "a" }], 0)
				.commit()

			const data = store.scan()
			assert.deepEqual(data.length, 1)
		})

		it("inserts get deduplicated set/remove in same transaction with initial tuple", () => {
			const store = createStorage(randomId())

			store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.commit()

			store
				.transact()
				.set(["a", { uuid: "a" }], 1)
				.remove(["a", { uuid: "a" }])
				.commit()

			const data = store.scan()
			assert.deepEqual(data.length, 0)
		})

		it("inserts get deduplicated remove/set in same transaction with initial tuple", () => {
			const store = createStorage(randomId())

			store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.commit()

			store
				.transact()
				.remove(["a", { uuid: "a" }])
				.set(["a", { uuid: "a" }], 1)
				.commit()

			const data = store.scan()
			assert.deepEqual(data.length, 1)
		})

		it("removes items correctly", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			assert.deepEqual(transaction.scan(), items)

			transaction.remove(["a", "a", "c"])
			transaction.remove(["a", "c", "a"])
			transaction.remove(["a", "b", "b"])

			const data = transaction.scan()
			assert.deepEqual(data, [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "b", "a"], 4],
				[["a", "b", "c"], 6],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
			transaction.commit()
			assert.deepEqual(store.scan(), data)
		})

		it("scan gt", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				gt: ["a", "a", MAX],
			})

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
		})

		it("scan gt/lt", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				gt: ["a", "a", MAX],
				lt: ["a", "c", MIN],
			})

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])

			const result2 = store.scan({
				gt: ["a", "b", MIN],
				lt: ["a", "b", MAX],
			})

			assert.deepEqual(result2, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])
		})

		it("scan prefix", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				prefix: ["a", "b"],
			})

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])
		})

		it("scan prefix gte/lte", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "b", "d"], 6.5],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]

			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				prefix: ["a", "b"],
				gte: ["b"],
				lte: ["d"],
			})

			assert.deepEqual(result, [
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "b", "d"], 6.5],
			])
		})

		it("scan gte", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				gte: ["a", "b", "a"],
			})

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
		})

		it("scan gte/lte", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				gte: ["a", "a", "c"],
				lte: ["a", "c", MAX],
			})

			assert.deepEqual(result, [
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
		})

		it("scan sorted gt", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				gt: ["a", "b", MAX],
			})

			assert.deepEqual(result, [
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
		})

		it("scan sorted gt/lt", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				gt: ["a", "a", MAX],
				lt: ["a", "b", MAX],
			})

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])
		})

		it("scan sorted gte", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				gte: ["a", "b", MIN],
			})

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
		})

		it("scan sorted gte/lte", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({
				gte: ["a", "a", "c"],
				lte: ["a", "b", MAX],
			})

			assert.deepEqual(result, [
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])
		})

		it("scan invalid bounds", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			try {
				store.scan({
					gte: ["a", "c"],
					lte: ["a", "a"],
				})
				assert.fail("Should fail.")
			} catch (error) {
				assert.ok(error)
			}
		})

		it("stores all types of values", () => {
			const store = createStorage(randomId())
			const items: TupleValuePair[] = sortedValues.map(
				(item, i) => [[item], i] as TupleValuePair
			)
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)
		})

		it("transaction overwrites when scanning data out", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assert.deepEqual(data, items)

			const result = store.scan({ prefix: ["a", "b"] })

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])

			const transaction2 = store.transact()
			transaction2.set(["a", "b", "b"], 99)
			const result2 = transaction2.scan({ prefix: ["a", "b"] })
			assert.deepEqual(result2, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 99],
				[["a", "b", "c"], 6],
			])
		})

		it("get", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()

			assert.deepEqual(store.get(["a", "a", "c"]), 3)
			assert.deepEqual(store.get(["a", "c", "c"]), 9)
			assert.deepEqual(store.get(["a", "c", "d"]), undefined)
		})

		it("transaction overwrites get", () => {
			const store = createStorage(randomId())

			store.transact().set(["a"], 1).set(["b"], 2).set(["c"], 3).commit()

			const tr = store.transact()
			tr.set(["a"], 2)
			assert.deepEqual(store.get(["a"]), 1)
			assert.deepEqual(tr.get(["a"]), 2)

			tr.remove(["b"])
			assert.deepEqual(store.get(["b"]), 2)
			assert.deepEqual(tr.get(["b"]), undefined)

			tr.set(["d"], 99)
			assert.deepEqual(store.get(["d"]), undefined)
			assert.deepEqual(tr.get(["d"]), 99)
		})

		it("exists", () => {
			const store = createStorage(randomId())

			const items: TupleValuePair[] = [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			]
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()

			assert.deepEqual(store.exists(["a", "a", "c"]), true)
			assert.deepEqual(store.exists(["a", "c", "c"]), true)
			assert.deepEqual(store.exists(["a", "c", "d"]), false)
		})

		it("transaction overwrites exists", () => {
			const store = createStorage(randomId())

			store.transact().set(["a"], 1).set(["b"], 2).set(["c"], 3).commit()

			const tr = store.transact()
			tr.set(["a"], 2)
			assert.deepEqual(store.exists(["a"]), true)
			assert.deepEqual(tr.exists(["a"]), true)

			tr.remove(["b"])
			assert.deepEqual(store.exists(["b"]), true)
			assert.deepEqual(tr.exists(["b"]), false)

			tr.set(["d"], 99)
			assert.deepEqual(store.exists(["d"]), false)
			assert.deepEqual(tr.exists(["d"]), true)
		})

		// All tests below here should be durable tests
		if (!durable) return
		describe("Persistence", () => {
			it("persists properly", () => {
				const id = randomId()
				const store = createStorage(id)

				const items: TupleValuePair[] = [
					[["a", "a", "a"], 1],
					[["a", "a", "b"], 2],
					[["a", "a", "c"], 3],
					[["a", "b", "a"], 4],
					[["a", "b", "b"], 5],
					[["a", "b", "c"], 6],
					[["a", "c", "a"], 7],
					[["a", "c", "b"], 8],
					[["a", "c", "c"], 9],
				]
				const transaction = store.transact()
				for (const [key, value] of _.shuffle(items)) {
					transaction.set(key, value)
				}
				transaction.commit()
				const data = store.scan()
				assert.deepEqual(data, items)

				store.close()

				const store2 = createStorage(id)
				const data2 = store2.scan()
				assert.deepEqual(data2, items)
			})
		})
	})
}

storageTestSuite(
	"InMemoryStorage",
	sortedValues,
	() => new InMemoryStorage(),
	false
)

const tmpDir = __dirname + "/../../tmp/"

storageTestSuite(
	"FileStorage",
	sortedValues,
	(id) => new FileStorage(tmpDir + id)
)

storageTestSuite(
	"SQLiteStorage",
	sortedValues,
	(id) => new SQLiteStorage(sqlite(tmpDir + id + ".db"))
)
