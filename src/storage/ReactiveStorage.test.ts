import { strict as assert } from "assert"
import * as _ from "lodash"
import { describe, it } from "mocha"
import { InMemoryStorage } from "./InMemoryStorage"
import { ReactiveStorage } from "./ReactiveStorage"
import { MAX, MIN, TupleValuePair, Writes } from "./types"

function createStorage() {
	return new ReactiveStorage(new InMemoryStorage())
}

describe("ReactiveStorage", () => {
	it("works with set", () => {
		const store = createStorage()
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

		let hoist: Writes | undefined
		store.subscribe({ gt: ["a", "a", MAX], lt: ["a", "c", MIN] }, (writes) => {
			hoist = writes
		})

		store.transact().set(["a", "b", 1], 1).commit()

		assert.deepStrictEqual(hoist, {
			set: [[["a", "b", 1], 1]],
			remove: [],
		} as Writes)
	})

	it("works with remove", () => {
		const store = createStorage()
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
		const store = createStorage()
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

		let hoist: Writes | undefined
		store.subscribe({ prefix: ["a", "b"] }, (writes) => {
			hoist = writes
		})

		store.transact().set(["a", "b", "a"], 99).commit()

		assert.deepStrictEqual(hoist, {
			set: [[["a", "b", "a"], 99]],
			remove: [],
		} as Writes)
	})

	it("should use prefix correctly and filter bounds", () => {
		const store = createStorage()
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

		// Note that these queries are *basically* the same.
		// { gt: ["a", "a", MAX], lt: ["a", "c", MIN] },
		// { gt: ["a", "b", MIN], lt: ["a", "b", MAX] },
		// But the second one has better reactivity performance due to the shared prefix.

		let hoist1: Writes | undefined
		store.subscribe({ gt: ["a", "b", MIN], lt: ["a", "b", MAX] }, (writes) => {
			hoist1 = writes
		})

		let hoist2: Writes | undefined
		store.subscribe({ gt: ["a", "a", MAX], lt: ["a", "c", MIN] }, (writes) => {
			hoist2 = writes
		})

		let hoist3: Writes | undefined
		store.subscribe({ gt: ["a", "a", MAX], lt: ["a", "c", MAX] }, (writes) => {
			hoist3 = writes
		})

		store.transact().set(["a", "c", 1], 1).commit()

		assert.deepStrictEqual(hoist1, undefined)

		// Even though the prefix matches, isWithinBounds should filter this out.
		assert.deepStrictEqual(hoist2, undefined)

		assert.deepStrictEqual(hoist3, {
			set: [[["a", "c", 1], 1]],
			remove: [],
		} as Writes)
	})

	it("indexers work", () => {
		const store = new ReactiveStorage(new InMemoryStorage())

		// A triplestore-like indexing setup.
		store.index((tx, op) => {
			const [index, e, a, v] = op.tuple
			if (index !== "eav") return
			if (op.type === "set") {
				tx.set(["ave", a, v, e], op.value)
				tx.set(["vea", v, e, a], op.value)
				tx.set(["vae", v, a, e], op.value)
			} else {
				tx.remove(["ave", a, v, e])
				tx.remove(["vea", v, e, a])
				tx.remove(["vae", v, a, e])
			}
		})

		const tx = store.transact()

		tx.set(["eav", "0001", "type", "Person"], null)
			.set(["eav", "0001", "firstName", "Chet"], null)
			.set(["eav", "0001", "lastName", "Corcos"], null)
			.set(["eav", "0002", "type", "Person"], null)
			.set(["eav", "0002", "firstName", "Meghan"], null)
			.set(["eav", "0002", "lastName", "Navarro"], null)

		// Test that the indexer is running on every write within a transaction.
		assert.deepStrictEqual(tx.scan({ prefix: ["ave", "type", "Person"] }), [
			[["ave", "type", "Person", "0001"], null],
			[["ave", "type", "Person", "0002"], null],
		])

		tx.commit()

		// Test that the result is written to storage.
		assert.deepStrictEqual(store.scan({ prefix: ["ave", "type", "Person"] }), [
			[["ave", "type", "Person", "0001"], null],
			[["ave", "type", "Person", "0002"], null],
		])

		let hoist: Writes | undefined
		store.subscribe({ prefix: ["ave", "type", "Person"] }, (writes) => {
			hoist = writes
		})

		store
			.transact()
			.set(["eav", "0003", "type", "Person"], null)
			.set(["eav", "0003", "firstName", "Sam"], null)
			.set(["eav", "0003", "lastName", "Corcos"], null)
			.commit()

		assert.deepStrictEqual(hoist, {
			set: [[["ave", "type", "Person", "0003"], null]],
			remove: [],
		} as Writes)
	})
})
