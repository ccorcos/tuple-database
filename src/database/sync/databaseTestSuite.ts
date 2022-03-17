/*

This file is generated from async/asyncDatabaseTestSuite.ts

*/

type Identity<T> = T

import { strict as assert } from "assert"
import * as _ from "lodash"
import { sum } from "lodash"
import { describe, it } from "mocha"
import { randomId } from "../../helpers/randomId"
import { KeyValuePair, MAX, MIN, Writes } from "../../storage/types"
import { assertEqual } from "../../test/assertHelpers"
import { sortedValues } from "../../test/fixtures"
import { Assert } from "../typeHelpers"
import { transactionalQuery } from "./transactionalQuery"
import { TupleDatabaseClientApi, TupleTransactionApi } from "./types"

export function databaseTestSuite(
	name: string,
	createStorage: <S extends KeyValuePair = KeyValuePair>(
		id: string
	) => TupleDatabaseClientApi<S>,
	durable = true
) {
	describe(name, () => {
		it("inserts in correct order", () => {
			const store = createStorage(randomId())
			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)
		})

		it("inserting the same thing gets deduplicated", () => {
			const store = createStorage(randomId())
			const transaction = store.transact()
			transaction.set(["a", "a"], 0)
			transaction.set(["a", "a"], 0)
			transaction.commit()
			const data = store.scan()
			assertEqual(data, [{ key: ["a", "a"], value: 0 }])
		})

		it("updates will overwrite the value", () => {
			const store = createStorage(randomId())
			const transaction = store.transact()
			transaction.set(["a", "a"], 0)
			transaction.set(["a", "a"], 1)
			transaction.commit()
			const data = store.scan()
			assertEqual(data, [{ key: ["a", "a"], value: 1 }])
		})

		it("transaction value overwrites works", () => {
			const store = createStorage(randomId())
			const transaction = store.transact()
			transaction.set(["a", "a"], 0)
			transaction.commit()
			const data = store.scan()
			assertEqual(data, [{ key: ["a", "a"], value: 0 }])

			const transaction2 = store.transact()
			transaction2.set(["a", "a"], 1)
			const data2 = transaction2.scan()
			assertEqual(data2, [{ key: ["a", "a"], value: 1 }])

			transaction2.commit()
			const data3 = store.scan()
			assertEqual(data3, [{ key: ["a", "a"], value: 1 }])
		})

		it("inserts the same thing gets deduplicated with ids", () => {
			const store = createStorage(randomId())
			store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.set(["a", { uuid: "a" }], 0)
				.commit()
			const data = store.scan()
			assertEqual(data.length, 1)
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
			assertEqual(data.length, 1)
		})

		it("inserts get deduplicated set/remove in same transaction", () => {
			const store = createStorage(randomId())

			store
				.transact()
				.set(["a", { uuid: "a" }], 0)
				.remove(["a", { uuid: "a" }])
				.commit()

			const data = store.scan()
			assertEqual(data.length, 0, `data: ${JSON.stringify(data)}`)
		})

		it("inserts get deduplicated remove/set in same transaction", () => {
			const store = createStorage(randomId())

			store
				.transact()
				.remove(["a", { uuid: "a" }])
				.set(["a", { uuid: "a" }], 0)
				.commit()

			const data = store.scan()
			assertEqual(data.length, 1)
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
			assertEqual(data.length, 0)
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
			assertEqual(data.length, 1)
		})

		it("removes items correctly", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			assertEqual(transaction.scan(), items)

			transaction.remove(["a", "a", "c"])
			transaction.remove(["a", "c", "a"])
			transaction.remove(["a", "b", "b"])

			const data = transaction.scan()
			assertEqual(data, [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			])
			transaction.commit()
			assertEqual(store.scan(), data)
		})

		it("transaction.write()", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]

			store.transact().write({ set: items }).commit()
			let data = store.scan()
			assertEqual(data, items)

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
			assertEqual(data, [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			])
		})

		it("scan gt", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				gt: ["a", "a", MAX],
			})

			assertEqual(result, [
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			])
		})

		it("scan gt/lt", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				gt: ["a", "a", MAX],
				lt: ["a", "c", MIN],
			})

			assertEqual(result, [
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
			])

			const result2 = store.scan({
				gt: ["a", "b", MIN],
				lt: ["a", "b", MAX],
			})

			assertEqual(result2, [
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
			])
		})

		it("scan prefix", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				prefix: ["a", "b"],
			})

			assertEqual(result, [
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
			])
		})

		it("scan prefix gte/lte", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "b", "d"], value: 6.5 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]

			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				prefix: ["a", "b"],
				gte: ["b"],
				lte: ["d"],
			})

			assertEqual(result, [
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "b", "d"], value: 6.5 },
			])
		})

		it("scan gte", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				gte: ["a", "b", "a"],
			})

			assertEqual(result, [
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			])
		})

		it("scan gte/lte", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				gte: ["a", "a", "c"],
				lte: ["a", "c", MAX],
			})

			assertEqual(result, [
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			])
		})

		it("scan sorted gt", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				gt: ["a", "b", MAX],
			})

			assertEqual(result, [
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			])
		})

		it("scan sorted gt/lt", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				gt: ["a", "a", MAX],
				lt: ["a", "b", MAX],
			})

			assertEqual(result, [
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
			])
		})

		it("scan sorted gte", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				gte: ["a", "b", MIN],
			})

			assertEqual(result, [
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			])
		})

		it("scan sorted gte/lte", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({
				gte: ["a", "a", "c"],
				lte: ["a", "b", MAX],
			})

			assertEqual(result, [
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
			])
		})

		it("scan invalid bounds", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

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
			const items: KeyValuePair[] = sortedValues.map(
				(item, i) => ({ key: [item], value: i } as KeyValuePair)
			)
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)
		})

		it("transaction overwrites when scanning data out", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()
			const data = store.scan()
			assertEqual(data, items)

			const result = store.scan({ prefix: ["a", "b"] })

			assertEqual(result, [
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
			])

			const transaction2 = store.transact()
			transaction2.set(["a", "b", "b"], 99)
			const result2 = transaction2.scan({ prefix: ["a", "b"] })
			assertEqual(result2, [
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 99 },
				{ key: ["a", "b", "c"], value: 6 },
			])
		})

		it("get", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()

			assertEqual(store.get(["a", "a", "c"]), 3)
			assertEqual(store.get(["a", "c", "c"]), 9)
			assertEqual(store.get(["a", "c", "d"]), undefined)
		})

		it("transaction overwrites get", () => {
			const store = createStorage(randomId())

			store.transact().set(["a"], 1).set(["b"], 2).set(["c"], 3).commit()

			const tr = store.transact()
			tr.set(["a"], 2)
			assertEqual(store.get(["a"]), 1)
			assertEqual(tr.get(["a"]), 2)

			tr.remove(["b"])
			assertEqual(store.get(["b"]), 2)
			assertEqual(tr.get(["b"]), undefined)

			tr.set(["d"], 99)
			assertEqual(store.get(["d"]), undefined)
			assertEqual(tr.get(["d"]), 99)
		})

		it("exists", () => {
			const store = createStorage(randomId())

			const items: KeyValuePair[] = [
				{ key: ["a", "a", "a"], value: 1 },
				{ key: ["a", "a", "b"], value: 2 },
				{ key: ["a", "a", "c"], value: 3 },
				{ key: ["a", "b", "a"], value: 4 },
				{ key: ["a", "b", "b"], value: 5 },
				{ key: ["a", "b", "c"], value: 6 },
				{ key: ["a", "c", "a"], value: 7 },
				{ key: ["a", "c", "b"], value: 8 },
				{ key: ["a", "c", "c"], value: 9 },
			]
			const transaction = store.transact()
			for (const { key, value } of _.shuffle(items)) {
				transaction.set(key, value)
			}
			transaction.commit()

			assertEqual(store.exists(["a", "a", "c"]), true)
			assertEqual(store.exists(["a", "c", "c"]), true)
			assertEqual(store.exists(["a", "c", "d"]), false)
		})

		it("transaction overwrites exists", () => {
			const store = createStorage(randomId())

			store.transact().set(["a"], 1).set(["b"], 2).set(["c"], 3).commit()

			const tr = store.transact()
			tr.set(["a"], 2)
			assertEqual(store.exists(["a"]), true)
			assertEqual(tr.exists(["a"]), true)

			tr.remove(["b"])
			assertEqual(store.exists(["b"]), true)
			assertEqual(tr.exists(["b"]), false)

			tr.set(["d"], 99)
			assertEqual(store.exists(["d"]), false)
			assertEqual(tr.exists(["d"]), true)
		})

		it("committing a transaction prevents any further interaction", () => {
			const store = createStorage(randomId())
			const tx = store.transact()
			tx.commit()

			assert.throws(() => tx.get([1]))
			assert.throws(() => tx.exists([1]))
			assert.throws(() => tx.scan())
			assert.throws(() => tx.write({}))
			assert.throws(() => tx.set([1], 2))
			assert.throws(() => tx.remove([1]))
			assert.throws(() => tx.cancel())
			assert.throws(() => tx.commit())
		})

		it("canceling a transaction prevents any further interaction", () => {
			const store = createStorage(randomId())
			const tx = store.transact()
			tx.cancel()

			assert.throws(() => tx.get([1]))
			assert.throws(() => tx.exists([1]))
			assert.throws(() => tx.scan())
			assert.throws(() => tx.write({}))
			assert.throws(() => tx.set([1], 2))
			assert.throws(() => tx.remove([1]))
			assert.throws(() => tx.cancel())
			assert.throws(() => tx.commit())
		})

		it("cancelling a transaction does not submit writes", () => {
			const store = createStorage(randomId())
			const tx = store.transact()
			tx.set([1], 2)
			assertEqual(tx.get([1]), 2)
			tx.cancel()

			assertEqual(store.get([1]), undefined)
		})

		it.skip("cancelled transaction cannot conflict with other transactions")

		describe("application-level indexing", () => {
			it("bidirectional friends stored as keys", () => {
				const store = createStorage(randomId())

				function setAEV(
					[a, e, v]: [string, string, string],
					tx: TupleTransactionApi
				) {
					tx.set([a, e, v], null)
					if (a === "friend") tx.set([a, v, e], null)
				}

				function removeAEV(
					[a, e, v]: [string, string, string],
					tx: TupleTransactionApi
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

				let result = store.scan().map(({ key }) => key)

				assertEqual(result, [
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
				result = tx.scan().map(({ key }) => key)

				assertEqual(result, [
					["friend", "a", "c"],
					["friend", "b", "c"],
					["friend", "c", "a"],
					["friend", "c", "b"],
					["name", "a", "Chet"],
					["name", "b", "Meghan"],
					["name", "c", "Andrew"],
				])

				setAEV(["friend", "d", "a"], tx)
				result = tx.scan().map(({ key }) => key)

				assertEqual(result, [
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

				function setPerson(person: Person, tx: TupleTransactionApi) {
					const prev = tx.get(["personById", person.id])
					if (prev) {
						tx.remove(["personByAge", prev.age, prev.id])
					}

					tx.set(["personById", person.id], person)
					tx.set(["personByAge", person.age, person.id], person)
				}

				function removePerson(personId: number, tx: TupleTransactionApi) {
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

				let result = store.scan().map(({ key }) => key)

				assertEqual(result, [
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
				result = tx.scan().map(({ key }) => key)

				assertEqual(result, [
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

				result = tx.scan().map(({ key }) => key)

				assertEqual(result, [
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
				store.commit({ set: [{ key: ["lamp"], value: false }] })

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
				assertEqual(store.get(["lamp"]), true)

				// Meghan will have to try again.
				const meghan2 = store.transact()
				if (meghan2.get(["lamp"])) meghan2.set(["lamp"], false)
				meghan2.commit()

				// And she has her way.
				assertEqual(store.get(["lamp"]), false)
			})

			// NOTE: this test doesn't really make sense for the sync version...
			it("transactionalQuery will retry on those errors", () => {
				const id = randomId()
				type Schema = { key: ["score"]; value: number }
				const store = createStorage<Schema>(id)

				store.commit({ set: [{ key: ["score"], value: 0 }] })

				const sleep = (timeMs) =>
					new Promise((resolve) => setTimeout(resolve, timeMs))

				const incScore = transactionalQuery<Schema>()(
					(tx, amount: number, sleepMs: number) => {
						const score = tx.get(["score"])!
						sleep(sleepMs)
						tx.set(["score"], score + amount)
					}
				)

				// 0 -> chet reads
				// 1 -> meghan reads
				// 2 -> chet writes
				// 3 -> meghan writes -- conflict!
				// 3 -> meghan reads -- retry
				// 4 -> meghan writes -- success!

				function chet() {
					incScore(store, 10, 2)
					assertEqual(store.get(["score"]), 10)
				}

				function meghan() {
					sleep(1)
					incScore(store, -1, 2)
					assertEqual(store.get(["score"]), 9)
				}

				Promise.all([chet(), meghan()])

				// Final state.
				assertEqual(store.get(["score"]), 9)
			})

			it("should probably generalize to scans as well", () => {
				const id = randomId()
				type Schema =
					| { key: ["player", string, number]; value: null }
					| { key: ["total", number]; value: null }
				const store = createStorage<Schema>(id)
				store.commit({
					set: [
						// TODO: add test using value as well.
						{ key: ["player", "chet", 0], value: null },
						{ key: ["player", "meghan", 0], value: null },
						{ key: ["total", 0], value: null },
					],
				})

				// We have a score keeping game.
				const addScore = transactionalQuery<Schema>()(
					(tx, player: string, inc: number) => {
						// It has this miserable api, lol.
						const getPlayerScore = (player: string) => {
							const pairs = tx.scan({ prefix: ["player", player] })
							if (pairs.length !== 1) throw new Error("Missing player.")
							const [{ key }] = pairs
							return key[2]
						}

						const getCurrentTotal = () => {
							const totals = tx.scan({ prefix: ["total"] })
							if (totals.length !== 1) throw new Error("Too many totals.")
							const [{ key }] = totals
							return key[1]
						}

						const resetTotal = () => {
							const pairs = tx.scan({ prefix: ["player"] })
							const total = sum(pairs.map(({ key }) => key[2]))
							tx.remove(["total", getCurrentTotal()])
							tx.set(["total", total], null)
						}

						// But crucially, we reset the whole total whenever someone scores.
						const playerScore = getPlayerScore(player)
						tx.remove(["player", player, playerScore])
						tx.set(["player", player, playerScore + inc], null)

						resetTotal()
					}
				)

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
				assertEqual(store.scan({ prefix: [] }), [
					{ key: ["player", "chet", 0], value: null },
					{ key: ["player", "meghan", 1], value: null },
					{ key: ["total", 1], value: null },
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

			it.skip("can be used for transactional reads")
		})

		describe("Reactivity", () => {
			it("works with set", () => {
				const store = createStorage(randomId())
				const items: KeyValuePair[] = [
					{ key: ["a", "a", "a"], value: 1 },
					{ key: ["a", "a", "b"], value: 2 },
					{ key: ["a", "a", "c"], value: 3 },
					{ key: ["a", "b", "a"], value: 4 },
					{ key: ["a", "b", "b"], value: 5 },
					{ key: ["a", "b", "c"], value: 6 },
					{ key: ["a", "c", "a"], value: 7 },
					{ key: ["a", "c", "b"], value: 8 },
					{ key: ["a", "c", "c"], value: 9 },
				]
				const transaction = store.transact()
				for (const { key, value } of _.shuffle(items)) {
					transaction.set(key, value)
				}
				transaction.commit()

				const data = store.scan()
				assertEqual(data, items)

				let hoist: Writes | undefined
				store.subscribe(
					{ gt: ["a", "a", MAX], lt: ["a", "c", MIN] },
					(writes) => {
						hoist = writes
					}
				)

				store.transact().set(["a", "b", 1], 1).commit()

				assert.deepStrictEqual(hoist, {
					set: [{ key: ["a", "b", 1], value: 1 }],
					remove: [],
				} as Writes)
			})

			it("works with remove", () => {
				const store = createStorage(randomId())
				const items: KeyValuePair[] = [
					{ key: ["a", "a", "a"], value: 1 },
					{ key: ["a", "a", "b"], value: 2 },
					{ key: ["a", "a", "c"], value: 3 },
					{ key: ["a", "b", "a"], value: 4 },
					{ key: ["a", "b", "b"], value: 5 },
					{ key: ["a", "b", "c"], value: 6 },
					{ key: ["a", "c", "a"], value: 7 },
					{ key: ["a", "c", "b"], value: 8 },
					{ key: ["a", "c", "c"], value: 9 },
				]
				const transaction = store.transact()
				for (const { key, value } of _.shuffle(items)) {
					transaction.set(key, value)
				}
				transaction.commit()

				const data = store.scan()
				assertEqual(data, items)

				let hoist: Writes | undefined
				store.subscribe({ prefix: ["a", "b"] }, (writes) => {
					hoist = writes
				})

				store.transact().remove(["a", "b", "a"]).commit()

				assert.deepStrictEqual(hoist, {
					set: [],
					remove: [["a", "b", "a"]],
				} as Writes)
			})

			it("works when overwriting a value to an existing key", () => {
				const store = createStorage(randomId())
				const items: KeyValuePair[] = [
					{ key: ["a", "a", "a"], value: 1 },
					{ key: ["a", "a", "b"], value: 2 },
					{ key: ["a", "a", "c"], value: 3 },
					{ key: ["a", "b", "a"], value: 4 },
					{ key: ["a", "b", "b"], value: 5 },
					{ key: ["a", "b", "c"], value: 6 },
					{ key: ["a", "c", "a"], value: 7 },
					{ key: ["a", "c", "b"], value: 8 },
					{ key: ["a", "c", "c"], value: 9 },
				]
				const transaction = store.transact()
				for (const { key, value } of _.shuffle(items)) {
					transaction.set(key, value)
				}
				transaction.commit()

				const data = store.scan()
				assertEqual(data, items)

				let hoist: Writes | undefined
				store.subscribe({ prefix: ["a", "b"] }, (writes) => {
					hoist = writes
				})

				store.transact().set(["a", "b", "a"], 99).commit()

				assert.deepStrictEqual(hoist, {
					set: [{ key: ["a", "b", "a"], value: 99 }],
					remove: [],
				} as Writes)
			})

			it("should use prefix correctly and filter bounds", () => {
				const store = createStorage(randomId())
				const items: KeyValuePair[] = [
					{ key: ["a", "a", "a"], value: 1 },
					{ key: ["a", "a", "b"], value: 2 },
					{ key: ["a", "a", "c"], value: 3 },
					{ key: ["a", "b", "a"], value: 4 },
					{ key: ["a", "b", "b"], value: 5 },
					{ key: ["a", "b", "c"], value: 6 },
					{ key: ["a", "c", "a"], value: 7 },
					{ key: ["a", "c", "b"], value: 8 },
					{ key: ["a", "c", "c"], value: 9 },
				]
				const transaction = store.transact()
				for (const { key, value } of _.shuffle(items)) {
					transaction.set(key, value)
				}
				transaction.commit()

				const data = store.scan()
				assertEqual(data, items)

				// Note that these queries are *basically* the same.
				// { gt: ["a", "a", MAX], lt: ["a", "c", MIN] },
				// { gt: ["a", "b", MIN], lt: ["a", "b", MAX] },
				// But the second one has better reactivity performance due to the shared prefix.

				let hoist1: Writes | undefined
				store.subscribe(
					{ gt: ["a", "b", MIN], lt: ["a", "b", MAX] },
					(writes) => {
						hoist1 = writes
					}
				)

				let hoist2: Writes | undefined
				store.subscribe(
					{ gt: ["a", "a", MAX], lt: ["a", "c", MIN] },
					(writes) => {
						hoist2 = writes
					}
				)

				let hoist3: Writes | undefined
				store.subscribe(
					{ gt: ["a", "a", MAX], lt: ["a", "c", MAX] },
					(writes) => {
						hoist3 = writes
					}
				)

				store.transact().set(["a", "c", 1], 1).commit()

				assert.deepStrictEqual(hoist1, undefined)

				// Even though the prefix matches, isWithinBounds should filter this out.
				assert.deepStrictEqual(hoist2, undefined)

				assert.deepStrictEqual(hoist3, {
					set: [{ key: ["a", "c", 1], value: 1 }],
					remove: [],
				} as Writes)
			})
		})

		describe("subspace", () => {
			it("get/exists/scan works", () => {
				type Person = { id: string; name: string; age: number }
				type Schema =
					| { key: ["person", string]; value: Person }
					| { key: ["personByName", string, string]; value: Person }
					| { key: ["personByAge", number, string]; value: Person }

				const store = createStorage<Schema>(randomId())

				const writePerson = transactionalQuery<Schema>()(
					(tx, person: Person) => {
						tx.set(["person", person.id], person)
						tx.set(["personByName", person.name, person.id], person)
						tx.set(["personByAge", person.age, person.id], person)
					}
				)

				writePerson(store, { id: "1", name: "Chet", age: 31 })
				writePerson(store, { id: "2", name: "Meghan", age: 30 })
				writePerson(store, { id: "3", name: "Tanishq", age: 22 })

				const personByAge = store.subspace(["personByAge"])
				assertEqual(
					personByAge.scan().map(({ key }) => key[0]),
					[22, 30, 31]
				)
				assertEqual(personByAge.get([22, "3"])!.name, "Tanishq")
				assertEqual(personByAge.exists([31, "1"]), true)
				assertEqual(personByAge.exists([31, "2"]), false)
			})

			it("writes work", () => {
				type Schema = { key: ["a", number]; value: number }
				const store = createStorage<Schema>(randomId())

				store.commit({
					set: [
						{ key: ["a", 1], value: 1 },
						{ key: ["a", 2], value: 2 },
					],
				})

				const a = store.subspace(["a"])
				const tx = a.transact().set([3], 3)
				assertEqual(tx.get([1]), 1)
				assertEqual(tx.get([3]), 3)
				tx.commit()

				assertEqual(a.scan(), [
					{ key: [1], value: 1 },
					{ key: [2], value: 2 },
					{ key: [3], value: 3 },
				])
			})

			it("writes work in a nested subspace", () => {
				type Schema = { key: ["a", "a", number]; value: number }
				const store = createStorage<Schema>(randomId())

				store.commit({
					set: [
						{ key: ["a", "a", 1], value: 1 },
						{ key: ["a", "a", 2], value: 2 },
					],
				})

				const a = store.subspace(["a"])
				const aa = a.subspace(["a"])
				const tx = aa.transact().set([3], 3)
				assertEqual(tx.get([1]), 1)
				assertEqual(tx.get([3]), 3)
				tx.commit()
				assertEqual(aa.scan(), [
					{ key: [1], value: 1 },
					{ key: [2], value: 2 },
					{ key: [3], value: 3 },
				])
			})

			it("can create nested subspace inside a transaction", () => {
				type Schema = { key: ["a", "a", number]; value: number }
				const store = createStorage<Schema>(randomId())

				store.commit({
					set: [
						{ key: ["a", "a", 1], value: 1 },
						{ key: ["a", "a", 2], value: 2 },
					],
				})

				const a = store.subspace(["a"])
				const tx = a.transact()
				tx.set(["a", 3], 3)
				const aa = tx.subspace(["a"])
				aa.set([4], 4)

				assertEqual(aa.scan(), [
					{ key: [1], value: 1 },
					{ key: [2], value: 2 },
					{ key: [3], value: 3 },
					{ key: [4], value: 4 },
				])

				aa.commit()

				assertEqual(a.scan(), [
					{ key: ["a", 1], value: 1 },
					{ key: ["a", 2], value: 2 },
					{ key: ["a", 3], value: 3 },
					{ key: ["a", 4], value: 4 },
				])
			})

			it("scan args types work", () => {
				type Schema = { key: ["a", number]; value: number }
				const store = createStorage<Schema>(randomId())

				store.commit({
					set: [
						{ key: ["a", 1], value: 1 },
						{ key: ["a", 2], value: 2 },
					],
				})

				const a = store.subspace(["a"])

				assertEqual(a.scan({ gt: [1] }), [{ key: [2], value: 2 }])
			})
		})

		describe("subschema", () => {
			it("types work", () => {
				type SubSchema1 = { key: ["a", number]; value: number }
				type SubSchema2 = { key: ["b", string]; value: string }
				type Schema = SubSchema1 | SubSchema2
				const store = createStorage<Schema>(randomId())

				function module0(db: TupleDatabaseClientApi<Schema>) {
					const a1 = () => db.get(["a", 1])
					type A1 = Assert<ReturnType<typeof a1>, Identity<number | undefined>>

					const a2 = () => db.get(["b", ""])
					type A2 = Assert<ReturnType<typeof a2>, Identity<string | undefined>>

					const a3 = () => db.scan({ prefix: ["a"] })
					type A3 = Assert<ReturnType<typeof a3>, Identity<SubSchema1[]>>

					const a4 = () => db.scan({ prefix: ["b"] })
					type A4 = Assert<ReturnType<typeof a4>, Identity<SubSchema2[]>>

					const a5 = () => db.scan({ prefix: [] })
					type A5 = Assert<ReturnType<typeof a5>, Identity<Schema[]>>

					const a6 = () => db.subspace(["a"])
					type A6 = Assert<
						ReturnType<typeof a6>,
						TupleDatabaseClientApi<{
							key: [number]
							value: number
						}>
					>

					const a7 = () => db.subspace(["b"])
					type A7 = Assert<
						ReturnType<typeof a7>,
						TupleDatabaseClientApi<{
							key: [string]
							value: string
						}>
					>

					const a8 = () => db.transact()
					type A8 = Assert<ReturnType<typeof a8>, TupleTransactionApi<Schema>>
				}
				function module1(db: TupleDatabaseClientApi<SubSchema1>) {
					const a1 = () => db.get(["a", 1])
					type A1 = Assert<ReturnType<typeof a1>, Identity<number | undefined>>

					const a3 = () => db.scan({ prefix: ["a"] })
					type A3 = Assert<ReturnType<typeof a3>, Identity<SubSchema1[]>>

					// TODO: this is leaky! Maybe its best to use subspaces!
					const a5 = () => db.scan({ prefix: [] })
					type A5 = Assert<ReturnType<typeof a5>, Identity<SubSchema1[]>>

					const a6 = () => db.subspace(["a"])
					type A6 = Assert<
						ReturnType<typeof a6>,
						TupleDatabaseClientApi<{
							key: [number]
							value: number
						}>
					>

					const a8 = () => db.transact()
					type A8 = Assert<
						ReturnType<typeof a8>,
						TupleTransactionApi<SubSchema1>
					>
				}
				function module2(db: TupleDatabaseClientApi<SubSchema2>) {
					const a2 = () => db.get(["b", ""])
					type A2 = Assert<ReturnType<typeof a2>, Identity<string | undefined>>

					const a4 = () => db.scan({ prefix: ["b"] })
					type A4 = Assert<ReturnType<typeof a4>, Identity<SubSchema2[]>>

					// TODO: this is leaky!
					const a5 = () => db.scan({ prefix: [] })
					type A5 = Assert<ReturnType<typeof a5>, Identity<SubSchema2[]>>

					const a7 = () => db.subspace(["b"])
					type A7 = Assert<
						ReturnType<typeof a7>,
						TupleDatabaseClientApi<{
							key: [string]
							value: string
						}>
					>
				}

				module0(store)
				module1(store)
				module2(store)
			})

			it("types work", () => {
				type SubSchema1 = { key: ["a", number]; value: number }
				type SubSchema2 = { key: ["b", string]; value: string }
				type SubSchema3 = { key: ["c", boolean]; value: boolean }

				type Schema = SubSchema1 | SubSchema2
				const store = createStorage<Schema>(randomId())

				function module1(db: TupleDatabaseClientApi<SubSchema3>) {}
				function module2(db: TupleDatabaseClientApi<SubSchema3>) {}

				// @ts-expect-error
				module1(store)
				// @ts-expect-error
				module2(store)
			})
		})

		if (durable) {
			describe("Persistence", () => {
				it("persists properly", () => {
					const id = randomId()
					const store = createStorage(id)

					const items: KeyValuePair[] = [
						{ key: ["a", "a", "a"], value: 1 },
						{ key: ["a", "a", "b"], value: 2 },
						{ key: ["a", "a", "c"], value: 3 },
						{ key: ["a", "b", "a"], value: 4 },
						{ key: ["a", "b", "b"], value: 5 },
						{ key: ["a", "b", "c"], value: 6 },
						{ key: ["a", "c", "a"], value: 7 },
						{ key: ["a", "c", "b"], value: 8 },
						{ key: ["a", "c", "c"], value: 9 },
					]
					const transaction = store.transact()
					for (const { key, value } of _.shuffle(items)) {
						transaction.set(key, value)
					}
					transaction.commit()

					const data = store.scan()
					assertEqual(data, items)

					store.close()

					const store2 = createStorage(id)
					const data2 = store2.scan()
					assertEqual(data2, items)
				})
			})
		}
	})
}
