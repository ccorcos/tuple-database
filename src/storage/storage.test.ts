/*

	Storage Tests.
	./node_modules/.bin/mocha -r ts-node/register ./src/storage/storage.test.ts

*/

import { describe, it } from "mocha"
import assert from "assert"
import { InMemoryStorage } from "./InMemoryStorage"
import { FileStorage } from "./FileStorage"
import { MAX, MIN, Storage, Tuple } from "./types"
import * as _ from "lodash"
import { randomId } from "../helpers/randomId"
import { sortedValues } from "../test/fixtures"
import { SQLiteStorage } from "./SQLiteStorage"

function storageTestSuite(name: string, createStorage: () => Storage) {
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

storageTestSuite("InMemoryStorage", () => new InMemoryStorage())

const tmpDir = __dirname + "/../../tmp/"

storageTestSuite("FileStorage", () => new FileStorage(tmpDir + randomId()))

storageTestSuite(
	"SQLiteStorage",
	() => new SQLiteStorage(tmpDir + randomId() + ".db")
)
