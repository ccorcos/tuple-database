/*

	Storage Tests.
	./node_modules/.bin/mocha -r ts-node/register ./src/storage/storage.test.ts

*/

import assert from "assert"
import sqlite from "better-sqlite3"
import * as _ from "lodash"
import { describe, it } from "mocha"
import { randomId } from "../helpers/randomId"
import { sortedValues } from "../test/fixtures"
import { FileStorage } from "./FileStorage"
import { InMemoryStorage } from "./InMemoryStorage"
import { ReactiveStorage } from "./ReactiveStorage"
import { SQLiteStorage } from "./SQLiteStorage"
import { MAX, MIN, Storage, Tuple } from "./types"

function storageTestSuite(
	name: string,
	sortedValues: Tuple,
	createStorage: () => Storage
) {
	describe(name, () => {
		it("inserts in correct order", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)
		})

		it("inserts the same thing gets deduplicated", () => {
			const store = createStorage()
			const index = "abc"
			const transaction = store.transact()
			transaction.set(index, ["a", "a"])
			transaction.set(index, ["a", "a"])
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, [["a", "a"]])
		})

		it("inserts the same thing gets deduplicated with ids", () => {
			const store = createStorage()
			const index = "abc"
			store
				.transact()
				.set(index, ["a", { uuid: "a" }])
				.set(index, ["a", { uuid: "a" }])
				.commit()
			const data = store.scan(index)
			assert.deepEqual(data.length, 1)
		})

		it("inserts get deduplicated in separate transactions", () => {
			const store = createStorage()
			const index = "abc"
			store
				.transact()
				.set(index, ["a", { uuid: "a" }])
				.commit()

			store
				.transact()
				.set(index, ["a", { uuid: "a" }])
				.commit()

			const data = store.scan(index)
			assert.deepEqual(data.length, 1)
		})

		it("1inserts get deduplicated set/remove in same transaction", () => {
			const store = createStorage()
			const index = "abc"
			store
				.transact()
				.set(index, ["a", { uuid: "a" }])
				.remove(index, ["a", { uuid: "a" }])
				.commit()

			const data = store.scan(index)
			assert.deepEqual(data.length, 0, `data: ${JSON.stringify(data)}`)
		})

		it("inserts get deduplicated remove/set in same transaction", () => {
			const store = createStorage()
			const index = "abc"
			store
				.transact()
				.remove(index, ["a", { uuid: "a" }])
				.set(index, ["a", { uuid: "a" }])
				.commit()

			const data = store.scan(index)
			assert.deepEqual(data.length, 1)
		})

		it("inserts get deduplicated set/remove in same transaction with initial tuple", () => {
			const store = createStorage()
			const index = "abc"

			store
				.transact()
				.set(index, ["a", { uuid: "a" }])
				.commit()

			store
				.transact()
				.set(index, ["a", { uuid: "a" }])
				.remove(index, ["a", { uuid: "a" }])
				.commit()

			const data = store.scan(index)
			assert.deepEqual(data.length, 0)
		})

		it("inserts get deduplicated remove/set in same transaction with initial tuple", () => {
			const store = createStorage()
			const index = "abc"

			store
				.transact()
				.set(index, ["a", { uuid: "a" }])
				.commit()

			store
				.transact()
				.remove(index, ["a", { uuid: "a" }])
				.set(index, ["a", { uuid: "a" }])
				.commit()

			const data = store.scan(index)
			assert.deepEqual(data.length, 1)
		})

		it("removes items correctly", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			assert.deepEqual(transaction.scan(index), items)

			transaction.remove(index, ["a", "a", "c"])
			transaction.remove(index, ["a", "c", "a"])
			transaction.remove(index, ["a", "b", "b"])

			const data = transaction.scan(index)
			assert.deepEqual(data, [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "b", "a"],
				["a", "b", "c"],
				["a", "c", "b"],
				["a", "c", "c"],
			])
			transaction.commit()
			assert.deepEqual(store.scan(index), data)
		})

		it("scan gt", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				gt: ["a", "a", MAX],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			])
		})

		it("scan gt/lt", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				gt: ["a", "a", MAX],
				lt: ["a", "c", MIN],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
			])

			const result2 = store.scan(index, {
				gt: ["a", "b", MIN],
				lt: ["a", "b", MAX],
			})

			assert.deepEqual(result2, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
			])
		})

		it("scan prefix", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				prefix: ["a", "b"],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
			])
		})

		it("scan prefix gte/lte", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "b", "d"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				prefix: ["a", "b"],
				gte: ["b"],
				lte: ["d"],
			})

			assert.deepEqual(result, [
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "b", "d"],
			])
		})

		it("scan gte", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				gte: ["a", "b", "a"],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			])
		})

		it("scan gte/lte", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				gte: ["a", "a", "c"],
				lte: ["a", "c", MAX],
			})

			assert.deepEqual(result, [
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			])
		})

		it("scan sorted gt", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				gt: ["a", "b", MAX],
			})

			assert.deepEqual(result, [
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			])
		})

		it("scan sorted gt/lt", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				gt: ["a", "a", MAX],
				lt: ["a", "b", MAX],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
			])
		})

		it("scan sorted gte", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				gte: ["a", "b", MIN],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			])
		})

		it("scan sorted gte/lte", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				gte: ["a", "a", "c"],
				lte: ["a", "b", MAX],
			})

			assert.deepEqual(result, [
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
			])
		})

		it("scan invalid bounds", () => {
			const store = createStorage()
			const index = "abc"
			const items = [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			try {
				store.scan(index, {
					gte: ["a", "c"],
					lte: ["a", "a"],
				})
				assert.fail("Should fail.")
			} catch (error) {
				assert.ok(error)
			}
		})

		it("stores all types of values", () => {
			const store = createStorage()
			const index = "values"
			const items: Array<Tuple> = sortedValues.map((item) => [item])
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)
		})
	})
}

// Add this class
class AnyObject {}
const inMemorySortedValues = [...sortedValues]
inMemorySortedValues.splice(
	inMemorySortedValues.indexOf(null) + 1,
	0,
	new AnyObject()
)

storageTestSuite(
	"InMemoryStorage",
	inMemorySortedValues,
	() => new InMemoryStorage()
)

const tmpDir = __dirname + "/../../tmp/"

storageTestSuite(
	"FileStorage",
	sortedValues,
	() => new FileStorage(tmpDir + randomId())
)

storageTestSuite(
	"SQLiteStorage",
	sortedValues,
	() => new SQLiteStorage(sqlite(tmpDir + randomId() + ".db"))
)

storageTestSuite(
	"ReactiveStorage(SQLiteStorage)",
	sortedValues,
	() =>
		new ReactiveStorage(new SQLiteStorage(sqlite(tmpDir + randomId() + ".db")))
)
