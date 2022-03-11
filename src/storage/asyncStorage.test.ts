import { strict as assert } from "assert"
import level from "level"
import * as _ from "lodash"
import { sum } from "lodash"
import { describe, it } from "mocha"
import * as path from "path"
import { randomId } from "../helpers/randomId"
import { transactionalAsync } from "../helpers/transactional"
import { sortedValues } from "../test/fixtures"
import { AsyncTupleDatabase, AsyncTupleTransaction } from "./AsyncTupleDatabase"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { LevelTupleStorage } from "./LevelTupleStorage"
import { MAX, MIN, Tuple, TupleValuePair } from "./types"

function asyncStorageTestSuite(
	name: string,
	sortedValues: Tuple,
	createStorage: (id: string) => AsyncTupleDatabase,
	durable = true
) {
	describe(name, () => {
		it("inserts in correct order", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)
		})

		it("inserts the same thing gets deduplicated", async () => {
			const store = createStorage(randomId())
			const transaction = store.transact()
			transaction.set(["a", "a"], 0)
			transaction.set(["a", "a"], 0)
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, [[["a", "a"], 0]])
		})

		it("updates will overwrite the value", async () => {
			const store = createStorage(randomId())
			const transaction = store.transact()
			transaction.set(["a", "a"], 0)
			transaction.set(["a", "a"], 1)
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, [[["a", "a"], 1]])
		})

		it("transaction value overwrites works", async () => {
			const store = createStorage(randomId())
			const transaction = store.transact()
			transaction.set(["a", "a"], 0)
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, [[["a", "a"], 0]])

			const transaction2 = store.transact()
			transaction2.set(["a", "a"], 1)
			const data2 = await transaction2.scan()
			assert.deepEqual(data2, [[["a", "a"], 1]])

			await transaction2.commit()
			const data3 = await store.scan()
			assert.deepEqual(data3, [[["a", "a"], 1]])
		})

		it("inserts the same thing gets deduplicated with ids", async () => {
			const store = createStorage(randomId())
			await store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.set(["a", { uuid: "a" }], 0)
				.commit()
			const data = await store.scan()
			assert.deepEqual(data.length, 1)
		})

		it("inserts get deduplicated in separate transactions", async () => {
			const store = createStorage(randomId())

			await store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.commit()

			await store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.commit()

			const data = await store.scan()
			assert.deepEqual(data.length, 1)
		})

		it("inserts get deduplicated set/remove in same transaction", async () => {
			const store = createStorage(randomId())

			await store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.remove(["a", { uuid: "a" }])
				.commit()

			const data = await store.scan()
			assert.deepEqual(data.length, 0, `data: ${JSON.stringify(data)}`)
		})

		it("inserts get deduplicated remove/set in same transaction", async () => {
			const store = createStorage(randomId())

			await store
				.transact()
				.remove(["a", { uuid: "a" }])
				.set(["a", { uuid: "a" }], 0)
				.commit()

			const data = await store.scan()
			assert.deepEqual(data.length, 1)
		})

		it("inserts get deduplicated set/remove in same transaction with initial tuple", async () => {
			const store = createStorage(randomId())

			await store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.commit()

			await store
				.transact()
				.set(["a", { uuid: "a" }], 1)
				.remove(["a", { uuid: "a" }])
				.commit()

			const data = await store.scan()
			assert.deepEqual(data.length, 0)
		})

		it("inserts get deduplicated remove/set in same transaction with initial tuple", async () => {
			const store = createStorage(randomId())

			await store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.commit()

			await store
				.transact()
				.remove(["a", { uuid: "a" }])
				.set(["a", { uuid: "a" }], 1)
				.commit()

			const data = await store.scan()
			assert.deepEqual(data.length, 1)
		})

		it("removes items correctly", async () => {
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
			assert.deepEqual(await transaction.scan(), items)

			transaction.remove(["a", "a", "c"])
			transaction.remove(["a", "c", "a"])
			transaction.remove(["a", "b", "b"])

			const data = await transaction.scan()
			assert.deepEqual(data, [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "b", "a"], 4],
				[["a", "b", "c"], 6],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
			await transaction.commit()
			assert.deepEqual(await store.scan(), data)
		})

		it("transaction.write()", async () => {
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

			await store.transact().write({ set: items }).commit()
			let data = await store.scan()
			assert.deepEqual(data, items)

			await store
				.transact()
				.write({
					remove: [
						["a", "b", "a"],
						["a", "b", "b"],
						["a", "b", "c"],
					],
				})
				.commit()

			data = await store.scan()
			assert.deepEqual(data, [
				[["a", "a", "a"], 1],
				[["a", "a", "b"], 2],
				[["a", "a", "c"], 3],
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
		})

		it("scan gt", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
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

		it("scan gt/lt", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
				gt: ["a", "a", MAX],
				lt: ["a", "c", MIN],
			})

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])

			const result2 = await store.scan({
				gt: ["a", "b", MIN],
				lt: ["a", "b", MAX],
			})

			assert.deepEqual(result2, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])
		})

		it("scan prefix", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
				prefix: ["a", "b"],
			})

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])
		})

		it("scan prefix gte/lte", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
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

		it("scan gte", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
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

		it("scan gte/lte", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
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

		it("scan sorted gt", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
				gt: ["a", "b", MAX],
			})

			assert.deepEqual(result, [
				[["a", "c", "a"], 7],
				[["a", "c", "b"], 8],
				[["a", "c", "c"], 9],
			])
		})

		it("scan sorted gt/lt", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
				gt: ["a", "a", MAX],
				lt: ["a", "b", MAX],
			})

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])
		})

		it("scan sorted gte", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
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

		it("scan sorted gte/lte", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({
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

		it("scan invalid bounds", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			try {
				await store.scan({
					gte: ["a", "c"],
					lte: ["a", "a"],
				})
				assert.fail("Should fail.")
			} catch (error) {
				assert.ok(error)
			}
		})

		it("stores all types of values", async () => {
			const store = createStorage(randomId())
			const items: TupleValuePair[] = sortedValues.map(
				(item, i) => [[item], i] as TupleValuePair
			)
			const transaction = store.transact()
			for (const [key, value] of _.shuffle(items)) {
				transaction.set(key, value)
			}
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)
		})

		it("transaction overwrites when scanning data out", async () => {
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
			await transaction.commit()
			const data = await store.scan()
			assert.deepEqual(data, items)

			const result = await store.scan({ prefix: ["a", "b"] })

			assert.deepEqual(result, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 5],
				[["a", "b", "c"], 6],
			])

			const transaction2 = store.transact()
			transaction2.set(["a", "b", "b"], 99)
			const result2 = await transaction2.scan({ prefix: ["a", "b"] })
			assert.deepEqual(result2, [
				[["a", "b", "a"], 4],
				[["a", "b", "b"], 99],
				[["a", "b", "c"], 6],
			])
		})

		it("get", async () => {
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
			await transaction.commit()

			assert.deepEqual(await store.get(["a", "a", "c"]), 3)
			assert.deepEqual(await store.get(["a", "c", "c"]), 9)
			assert.deepEqual(await store.get(["a", "c", "d"]), undefined)
		})

		it("transaction overwrites get", async () => {
			const store = createStorage(randomId())

			await store.transact().set(["a"], 1).set(["b"], 2).set(["c"], 3).commit()

			const tr = store.transact()
			tr.set(["a"], 2)
			assert.deepEqual(await store.get(["a"]), 1)
			assert.deepEqual(await tr.get(["a"]), 2)

			tr.remove(["b"])
			assert.deepEqual(await store.get(["b"]), 2)
			assert.deepEqual(await tr.get(["b"]), undefined)

			tr.set(["d"], 99)
			assert.deepEqual(await store.get(["d"]), undefined)
			assert.deepEqual(await tr.get(["d"]), 99)
		})

		it("exists", async () => {
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
			await transaction.commit()

			assert.deepEqual(await store.exists(["a", "a", "c"]), true)
			assert.deepEqual(await store.exists(["a", "c", "c"]), true)
			assert.deepEqual(await store.exists(["a", "c", "d"]), false)
		})

		it("transaction overwrites exists", async () => {
			const store = createStorage(randomId())

			await store.transact().set(["a"], 1).set(["b"], 2).set(["c"], 3).commit()

			const tr = store.transact()
			tr.set(["a"], 2)
			assert.deepEqual(await store.exists(["a"]), true)
			assert.deepEqual(await tr.exists(["a"]), true)

			tr.remove(["b"])
			assert.deepEqual(await store.exists(["b"]), true)
			assert.deepEqual(await tr.exists(["b"]), false)

			tr.set(["d"], 99)
			assert.deepEqual(await store.exists(["d"]), false)
			assert.deepEqual(await tr.exists(["d"]), true)
		})

		describe("indexing happens at the application-level", () => {
			it("bidirectional friends stored as keys", async () => {
				const store = createStorage(randomId())

				function setAEV(
					[a, e, v]: [string, string, string],
					tx: AsyncTupleTransaction
				) {
					tx.set([a, e, v], null)
					if (a === "friend") tx.set([a, v, e], null)
				}

				function removeAEV(
					[a, e, v]: [string, string, string],
					tx: AsyncTupleTransaction
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
				await transaction.commit()

				let result = (await store.scan()).map(([tuple]) => tuple)

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
				result = (await tx.scan()).map(([tuple]) => tuple)

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
				result = (await tx.scan()).map(([tuple]) => tuple)

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

			it("indexing objects stored as values", async () => {
				const store = createStorage(randomId())

				type Person = { id: number; first: string; last: string; age: number }

				async function setPerson(person: Person, tx: AsyncTupleTransaction) {
					const prev = await tx.get(["personById", person.id])
					if (prev) {
						tx.remove(["personByAge", prev.age, prev.id])
					}

					tx.set(["personById", person.id], person)
					tx.set(["personByAge", person.age, person.id], person)
				}

				async function removePerson(
					personId: number,
					tx: AsyncTupleTransaction
				) {
					const prev = await tx.get(["personById", personId])
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
					await setPerson(person, transaction)
				}
				await transaction.commit()

				let result = (await store.scan()).map(([tuple]) => tuple)

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
				await removePerson(3, tx)
				result = (await tx.scan()).map(([tuple]) => tuple)

				assert.deepEqual(result, [
					["personByAge", 26, 2],
					["personByAge", 29, 1],
					["personByAge", 29, 4],
					["personById", 1],
					["personById", 2],
					["personById", 4],
				])

				await setPerson(
					{
						id: 1,
						first: "Chet",
						last: "Corcos",
						age: 30,
					},
					tx
				)

				result = (await tx.scan()).map(([tuple]) => tuple)

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

			it("works", async () => {
				const id = randomId()
				const store = createStorage(id)

				// The lamp is off
				store.commit({ set: [[["lamp"], false]] })

				// Chet wants the lamp on, Meghan wants the lamp off.
				const chet = store.transact()
				const meghan = store.transact()

				// Chet turns it on if its off.
				if (!(await chet.get(["lamp"]))) chet.set(["lamp"], true)

				// Meghan turns it off if its on.
				if (await meghan.get(["lamp"])) meghan.set(["lamp"], false)

				// Someone has to lose. Whoever commits first wins.
				await chet.commit()
				await assert.rejects(() => meghan.commit())
				assert.equal(await store.get(["lamp"]), true)

				// Meghan will have to try again.
				const meghan2 = store.transact()
				if (await meghan2.get(["lamp"])) meghan2.set(["lamp"], false)
				await meghan2.commit()

				// And she has her way.
				assert.equal(await store.get(["lamp"]), false)
			})

			it("should probably generalize to scans as well", async () => {
				const id = randomId()
				const store = createStorage(id)
				await store.commit({
					set: [
						// TODO: add test using value as well.
						[["player", "chet", 0], null],
						[["player", "meghan", 0], null],
						[["total", 0], null],
					],
				})

				// We have a score keeping game.
				const addScore = transactionalAsync(
					async (tx, player: string, inc: number) => {
						// It has this miserable api, lol.
						const getPlayerScore = async (player: string) => {
							const pairs = await tx.scan({ prefix: ["player", player] })
							if (pairs.length !== 1) throw new Error("Missing player.")
							const [[tuple, _value]] = pairs
							return tuple[2] as number
						}

						const getCurrentTotal = async () => {
							const totals = await tx.scan({ prefix: ["total"] })
							if (totals.length !== 1) throw new Error("Too many totals.")
							const [[tuple, _value]] = totals
							return tuple[1] as number
						}

						const resetTotal = async () => {
							const pairs = await tx.scan({ prefix: ["player"] })
							const total = sum(
								pairs.map(([tuple, _value]) => tuple[2] as number)
							)
							tx.remove(["total", await getCurrentTotal()])
							tx.set(["total", total], null)
						}

						// But crucially, we reset the whole total whenever someone scores.
						const playerScore = await getPlayerScore(player)
						tx.remove(["player", player, playerScore])
						tx.set(["player", player, playerScore + inc], null)

						await resetTotal()
					}
				)

				// Chet an meghan are playing a game.
				const chet = store.transact()
				const meghan = store.transact()

				// Chet
				await addScore(chet, "chet", 1)
				await addScore(meghan, "meghan", 1)

				// Whoever commits first will win.
				await meghan.commit()
				await assert.rejects(() => chet.commit())

				// Most importantly, the total will never be incorrect.
				assert.deepEqual(await store.scan({ prefix: [] }), [
					[["player", "chet", 0], null],
					[["player", "meghan", 1], null],
					[["total", 1], null],
				])
			})

			it("computes granular conflict based on tuple bounds, not prefix", async () => {
				const id = randomId()
				const store = createStorage(id)

				const a = store.transact()
				const b = store.transact()

				await a.scan({ gte: [1], lt: [10] })
				await b.scan({ gte: [10] })

				const c = store.transact()
				c.set([10], null)
				await c.commit()

				await a.commit() // ok
				await assert.rejects(() => b.commit())
			})
		})

		if (durable) {
			describe("Persistence", () => {
				it("persists properly", async () => {
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
					await transaction.commit()

					const data = await store.scan()
					assert.deepEqual(data, items)

					await store.close()

					const store2 = createStorage(id)
					const data2 = await store2.scan()
					assert.deepEqual(data2, items)
				})
			})
		}
	})
}

asyncStorageTestSuite(
	"AsyncTupleDatabase(InMemoryTupleStorage)",
	sortedValues,
	() => new AsyncTupleDatabase(new InMemoryTupleStorage()),
	false
)

// asyncStorageTestSuite(
// 	"ReactiveTupleDatabase(InMemoryTupleStorage)",
// 	sortedValues,
// 	() => new ReactiveTupleDatabase(new InMemoryTupleStorage()),
// 	false
// )

const tmpDir = path.resolve(__dirname, "/../../tmp")

asyncStorageTestSuite(
	"AsyncTupleDatabase(LevelTupleStorage)",
	sortedValues,
	(id) =>
		new AsyncTupleDatabase(
			new LevelTupleStorage(level(path.join(tmpDir, id + ".db")))
		)
)

// asyncStorageTestSuite(
// 	"ReactiveTupleDatabase(SQLiteTupleStorage)",
// 	sortedValues,
// 	(id) =>
// 		new ReactiveTupleDatabase(
// 			new SQLiteTupleStorage(sqlite(tmpDir + id + ".db"))
// 		)
// )
