/*

	Storage Tests.
	./node_modules/.bin/mocha -r ts-node/register ./src/storage/storage.test.ts

*/

import { describe, it } from "mocha"
import assert from "assert"
import { InMemoryStorage } from "./InMemoryStorage"
import { FileStorage } from "./FileStorage"
import { Index, Storage } from "./types"
import * as _ from "lodash"
import { rootPath } from "../helpers/rootPath"
import { randomId } from "../helpers/randomId"
import { sortedValues } from "../test/fixtures"
import { SQLiteStorage } from "./SQLiteStorage"

function storageTestSuite(name: string, createStorage: () => Storage) {
	describe(name, () => {
		it("inserts in correct order", () => {
			for (let i = 0; i < 10; i++) {
				const store = createStorage()
				const index: Index = { name: "abc", sort: [1, 1, 1] }
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
			}
		})

		it("inserts in correct sort order", () => {
			for (let i = 0; i < 10; i++) {
				const store = createStorage()
				const index: Index = { name: "abc", sort: [1, -1, 1] }
				const items = [
					["a", "c", "a"],
					["a", "c", "b"],
					["a", "c", "c"],
					["a", "b", "a"],
					["a", "b", "b"],
					["a", "b", "c"],
					["a", "a", "a"],
					["a", "a", "b"],
					["a", "a", "c"],
				]
				const transaction = store.transact()
				for (const item of _.shuffle(items)) {
					transaction.set(index, item)
				}
				transaction.commit()
				const data = store.scan(index)
				assert.deepEqual(data, items)
			}
		})

		it("removes items correctly", () => {
			const store = createStorage()
			const index: Index = { name: "abc", sort: [1, -1, 1] }
			const items = [
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
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
				["a", "c", "b"],
				["a", "c", "c"],
				["a", "b", "a"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
			])
			transaction.commit()
			assert.deepEqual(store.scan(index), data)
		})

		it("scan gt", () => {
			const store = createStorage()
			const index: Index = { name: "abc", sort: [1, 1, 1] }
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
				startAfter: ["a", "a"],
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
			const index: Index = { name: "abc", sort: [1, 1, 1] }
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
				startAfter: ["a", "a"],
				endBefore: ["a", "c"],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
			])
		})

		it("scan gte", () => {
			const store = createStorage()
			const index: Index = { name: "abc", sort: [1, 1, 1] }
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
				start: ["a", "b"],
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
			const index: Index = { name: "abc", sort: [1, 1, 1] }
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
				start: ["a", "a", "c"],
				end: ["a", "c"],
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
			const index: Index = { name: "abc", sort: [1, -1, 1] }
			const items = [
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				startAfter: ["a", "c"],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
			])
		})

		it("scan sorted gt/lt", () => {
			const store = createStorage()
			const index: Index = { name: "abc", sort: [1, -1, 1] }
			const items = [
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				startAfter: ["a", "c"],
				endBefore: ["a", "a"],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
			])
		})

		it("scan sorted gte", () => {
			const store = createStorage()
			const index: Index = { name: "abc", sort: [1, -1, 1] }
			const items = [
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				start: ["a", "b"],
			})

			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
			])
		})

		it("scan sorted gte/lte", () => {
			const store = createStorage()
			const index: Index = { name: "abc", sort: [1, -1, 1] }
			const items = [
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
			]
			const transaction = store.transact()
			for (const item of _.shuffle(items)) {
				transaction.set(index, item)
			}
			transaction.commit()
			const data = store.scan(index)
			assert.deepEqual(data, items)

			const result = store.scan(index, {
				start: ["a", "c", "c"],
				end: ["a", "a"],
			})

			assert.deepEqual(result, [
				["a", "c", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
			])
		})

		it("scan invalid bounds", () => {
			const store = createStorage()
			const index: Index = { name: "abc", sort: [1, -1, 1] }
			const items = [
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
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
					start: ["a", "a"],
					end: ["a", "c"],
				})
				assert.fail("Should fail.")
			} catch (error) {
				assert.ok(error)
			}
		})

		it("stores all types of values", () => {
			const store = createStorage()

			const index: Index = { name: "values", sort: [1] }
			const items = sortedValues.map((item) => [item])
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

storageTestSuite(
	"FileStorage",
	() => new FileStorage(rootPath("build", randomId()))
)

// storageTestSuite(
// 	"SQLiteStorage",
// 	() => new SQLiteStorage(rootPath("build", randomId() + ".db"))
// )
