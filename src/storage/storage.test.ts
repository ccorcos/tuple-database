/*

	Storage Tests.
	./node_modules/.bin/mocha -r ts-node/register ./src/storage/storage.test.ts

*/

import { strict as assert } from "assert"
import sqlite from "better-sqlite3"
import * as _ from "lodash"
import { sum } from "lodash"
import { describe, it } from "mocha"
import { randomId } from "../helpers/randomId"
import { transactional } from "../helpers/transactional"
import { sortedValues } from "../test/fixtures"
import { FileTupleStorage } from "./FileTupleStorage"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { ReactiveTupleDatabase } from "./ReactiveTupleDatabase"
import { SQLiteTupleStorage } from "./SQLiteTupleStorage"
import { TupleDatabase, TupleTransaction } from "./TupleDatabase"
import { MAX, MIN, Tuple, TupleValuePair } from "./types"

function storageTestSuite(
	name: string,
	sortedValues: Tuple,
	createStorage: (id: string) => TupleDatabase,
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

		it("transaction.write()", () => {
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

			store.transact().write({ set: items }).commit()
			let data = store.scan()
			assert.deepEqual(data, items)

			store
				.transact()
				.write({
					remove: [
						["a", "b", "a"],
						["a", "b", "b"],
						["a", "b", "c"],
					],
				})
				.commit()

			data = store.scan()
			assert.deepEqual(data, [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
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

		describe("indexing happens at the application-level", () => {
			it("bidirectional friends stored as keys", () => {
				const store = createStorage(randomId())

				function setAEV(
					[a, e, v]: [string, string, string],
					tx: TupleTransaction
				) {
					tx.set([a, e, v], null)
					if (a === "friend") tx.set([a, v, e], null)
				}

				function removeAEV(
					[a, e, v]: [string, string, string],
					tx: TupleTransaction
				) {
					tx.remove([a, e, v])
					if (a === "friend") tx.remove([a, v, e])
				}

				const items: [string, string, string][] = [
					["friend", "a", "b"],
					["friend", "a", "c"],
					["friend", "b", "c"],
					["name", "a", "Chet"],
					["name", "b", "Meghan"],
					["name", "c", "Andrew"],
				]
				const transaction = store.transact()
				for (const key of _.shuffle(items)) {
					setAEV(key, transaction)
				}
				transaction.commit()

				let result = store.scan().map(([tuple]) => tuple)

				assert.deepEqual(result, [
					["friend", "a", "b"],
					["friend", "a", "c"],
					["friend", "b", "a"],
					["friend", "b", "c"],
					["friend", "c", "a"],
					["friend", "c", "b"],
					["name", "a", "Chet"],
					["name", "b", "Meghan"],
					["name", "c", "Andrew"],
				])

				const tx = store.transact()
				removeAEV(["friend", "a", "b"], tx)
				result = tx.scan().map(([tuple]) => tuple)

				assert.deepEqual(result, [
					["friend", "a", "c"],
					["friend", "b", "c"],
					["friend", "c", "a"],
					["friend", "c", "b"],
					["name", "a", "Chet"],
					["name", "b", "Meghan"],
					["name", "c", "Andrew"],
				])

				setAEV(["friend", "d", "a"], tx)
				result = tx.scan().map(([tuple]) => tuple)

				assert.deepEqual(result, [
					["friend", "a", "c"],
					["friend", "a", "d"],
					["friend", "b", "c"],
					["friend", "c", "a"],
					["friend", "c", "b"],
					["friend", "d", "a"],
					["name", "a", "Chet"],
					["name", "b", "Meghan"],
					["name", "c", "Andrew"],
				])
			})

			it("indexing objects stored as values", () => {
				const store = createStorage(randomId())

				type Person = { id: number; first: string; last: string; age: number }

				function setPerson(person: Person, tx: TupleTransaction) {
					const prev = tx.get(["personById", person.id])
					if (prev) {
						tx.remove(["personByAge", prev.age, prev.id])
					}

					tx.set(["personById", person.id], person)
					tx.set(["personByAge", person.age, person.id], person)
				}

				function removePerson(personId: number, tx: TupleTransaction) {
					const prev = tx.get(["personById", personId])
					if (prev) {
						tx.remove(["personByAge", prev.age, prev.id])
						tx.remove(["personById", prev.id])
					}
				}

				const people: Person[] = [
					{ id: 1, first: "Chet", last: "Corcos", age: 29 },
					{ id: 2, first: "Simon", last: "Last", age: 26 },
					{ id: 3, first: "Jon", last: "Schwartz", age: 30 },
					{ id: 4, first: "Luke", last: "Hansen", age: 29 },
				]

				const transaction = store.transact()
				for (const person of _.shuffle(people)) {
					setPerson(person, transaction)
				}
				transaction.commit()

				let result = store.scan().map(([tuple]) => tuple)

				assert.deepEqual(result, [
					["personByAge", 26, 2],
					["personByAge", 29, 1],
					["personByAge", 29, 4],
					["personByAge", 30, 3],
					["personById", 1],
					["personById", 2],
					["personById", 3],
					["personById", 4],
				])

				const tx = store.transact()
				removePerson(3, tx)
				result = tx.scan().map(([tuple]) => tuple)

				assert.deepEqual(result, [
					["personByAge", 26, 2],
					["personByAge", 29, 1],
					["personByAge", 29, 4],
					["personById", 1],
					["personById", 2],
					["personById", 4],
				])

				setPerson(
					{
						id: 1,
						first: "Chet",
						last: "Corcos",
						age: 30,
					},
					tx
				)

				result = tx.scan().map(([tuple]) => tuple)

				assert.deepEqual(result, [
					["personByAge", 26, 2],
					["personByAge", 29, 4],
					["personByAge", 30, 1],
					["personById", 1],
					["personById", 2],
					["personById", 4],
				])
			})
		})

		describe("MVCC - Multi-version Concurrency Control", () => {
			// Basically, concurrent transactional read-writes.

			it("works", () => {
				const id = randomId()
				const store = createStorage(id)

				// The lamp is off
				store.commit({ set: [[["lamp"], false]] })

				// Chet wants the lamp on, Meghan wants the lamp off.
				const chet = store.transact()
				const meghan = store.transact()

				// Chet turns it on if its off.
				if (!chet.get(["lamp"])) chet.set(["lamp"], true)

				// Meghan turns it off if its on.
				if (meghan.get(["lamp"])) meghan.set(["lamp"], false)

				// Someone has to lose. Whoever commits first wins.
				chet.commit()
				assert.throws(() => meghan.commit())
				assert.equal(store.get(["lamp"]), true)

				// Meghan will have to try again.
				const meghan2 = store.transact()
				if (meghan2.get(["lamp"])) meghan2.set(["lamp"], false)
				meghan2.commit()

				// And she has her way.
				assert.equal(store.get(["lamp"]), false)
			})

			it("should probably generalize to scans as well", () => {
				const id = randomId()
				const store = createStorage(id)
				store.commit({
					set: [
						// TODO: add test using value as well.
						[["player", "chet", 0], null],
						[["player", "meghan", 0], null],
						[["total", 0], null],
					],
				})

				// We have a score keeping game.
				const addScore = transactional((tx, player: string, inc: number) => {
					// It has this miserable api, lol.
					const getPlayerScore = (player: string) => {
						const pairs = tx.scan({ prefix: ["player", player] })
						if (pairs.length !== 1) throw new Error("Missing player.")
						const [[tuple, _value]] = pairs
						return tuple[2] as number
					}

					const getCurrentTotal = () => {
						const totals = tx.scan({ prefix: ["total"] })
						if (totals.length !== 1) throw new Error("Too many totals.")
						const [[tuple, _value]] = totals
						return tuple[1] as number
					}

					const resetTotal = () => {
						const pairs = tx.scan({ prefix: ["player"] })
						const total = sum(
							pairs.map(([tuple, _value]) => tuple[2] as number)
						)
						tx.remove(["total", getCurrentTotal()])
						tx.set(["total", total], null)
					}

					// But crucially, we reset the whole total whenever someone scores.
					const playerScore = getPlayerScore(player)
					tx.remove(["player", player, playerScore])
					tx.set(["player", player, playerScore + inc], null)

					resetTotal()
				})

				// Chet an meghan are playing a game.
				const chet = store.transact()
				const meghan = store.transact()

				// Chet
				addScore(chet, "chet", 1)
				addScore(meghan, "meghan", 1)

				// Whoever commits first will win.
				meghan.commit()
				assert.throws(() => chet.commit())

				// Most importantly, the total will never be incorrect.
				assert.deepEqual(store.scan({ prefix: [] }), [
					[["player", "chet", 0], null],
					[["player", "meghan", 1], null],
					[["total", 1], null],
				])
			})

			it("computes granular conflict based on tuple bounds, not prefix", () => {
				const id = randomId()
				const store = createStorage(id)

				const a = store.transact()
				const b = store.transact()

				a.scan({ gte: [1], lt: [10] })
				b.scan({ gte: [10] })

				const c = store.transact()
				c.set([10], null)
				c.commit()

				a.commit() // ok
				assert.throws(() => b.commit())
			})
		})

		if (durable) {
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
		}
	})
}

storageTestSuite(
	"InMemoryTupleStorage",
	sortedValues,
	() => new TupleDatabase(new InMemoryTupleStorage()),
	false
)

storageTestSuite(
	"ReactiveTupleDatabase(InMemoryTupleStorage)",
	sortedValues,
	() => new ReactiveTupleDatabase(new InMemoryTupleStorage()),
	false
)

const tmpDir = __dirname + "/../../tmp/"

storageTestSuite(
	"FileTupleStorage",
	sortedValues,
	(id) => new TupleDatabase(new FileTupleStorage(tmpDir + id))
)

storageTestSuite(
	"SQLiteTupleStorage",
	sortedValues,
	(id) => new TupleDatabase(new SQLiteTupleStorage(sqlite(tmpDir + id + ".db")))
)

storageTestSuite(
	"ReactiveTupleDatabase(SQLiteTupleStorage)",
	sortedValues,
	(id) =>
		new ReactiveTupleDatabase(
			new SQLiteTupleStorage(sqlite(tmpDir + id + ".db"))
		)
)
