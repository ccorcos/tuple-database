import * as _ from "lodash"
import { describe, it } from "mocha"
import assert from "assert"
import { InMemoryStorage } from "./InMemoryStorage"
import { ReactiveStorage } from "./ReactiveStorage"
import { MAX, MIN, Writes } from "./types"

function createStorage() {
	return new ReactiveStorage(new InMemoryStorage())
}

describe("ReactiveStorage", () => {
	it("works", () => {
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

		let hoist: Writes | undefined
		store.subscribe(
			index,
			{ gt: ["a", "a", MAX], lt: ["a", "c", MIN] },
			(writes) => {
				hoist = writes
			}
		)

		store.transact().set(index, ["a", "b", 1]).commit()

		assert.deepStrictEqual(hoist, {
			abc: { sets: [["a", "b", 1]], removes: [] },
		})
	})

	it("should use prefix", () => {
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

		// Note that these queries are *basically* the same.
		// { gt: ["a", "a", MAX], lt: ["a", "c", MIN] },
		// { gt: ["a", "b", MIN], lt: ["a", "b", MAX] },
		// But the second one has better reactivity performance due to the shared prefix.

		let hoist1: Writes | undefined
		store.subscribe(
			index,
			{ gt: ["a", "b", MIN], lt: ["a", "b", MAX] },
			(writes) => {
				hoist1 = writes
			}
		)

		let hoist2: Writes | undefined
		store.subscribe(
			index,
			{ gt: ["a", "a", MAX], lt: ["a", "c", MIN] },
			(writes) => {
				hoist2 = writes
			}
		)

		let hoist3: Writes | undefined
		store.subscribe(
			index,
			{ gt: ["a", "a", MAX], lt: ["a", "c", MAX] },
			(writes) => {
				hoist3 = writes
			}
		)

		store.transact().set(index, ["a", "c", 1]).commit()

		assert.deepStrictEqual(hoist1, undefined)

		// Even though the prefix matches, isWithinBounds should filter this out.
		assert.deepStrictEqual(hoist2, undefined)

		assert.deepStrictEqual(hoist3, {
			abc: { sets: [["a", "c", 1]], removes: [] },
		})
	})

	it("indexers work", () => {
		const store = new ReactiveStorage(new InMemoryStorage(), [
			(tx, op) => {
				if (op.index === "eav") {
					const [e, a, v] = op.tuple
					tx[op.type]("ave", [a, v, e])
					tx[op.type]("vea", [v, e, a])
					tx[op.type]("vae", [v, a, e])
				}
			},
		])

		const tx = store.transact()

		tx.set("eav", ["0001", "type", "Person"])
			.set("eav", ["0001", "firstName", "Chet"])
			.set("eav", ["0001", "lastName", "Corcos"])
			.set("eav", ["0002", "type", "Person"])
			.set("eav", ["0002", "firstName", "Meghan"])
			.set("eav", ["0002", "lastName", "Navarro"])

		// Test that the indexer is running on every write within a transaction.
		assert.deepStrictEqual(tx.scan("ave", { prefix: ["type", "Person"] }), [
			["type", "Person", "0001"],
			["type", "Person", "0002"],
		])

		tx.commit()

		// Test that the result is written to storage.
		assert.deepStrictEqual(store.scan("ave", { prefix: ["type", "Person"] }), [
			["type", "Person", "0001"],
			["type", "Person", "0002"],
		])

		let hoist: Writes | undefined
		store.subscribe("ave", { prefix: ["type", "Person"] }, (writes) => {
			hoist = writes
		})

		store
			.transact()
			.set("eav", ["0003", "type", "Person"])
			.set("eav", ["0003", "firstName", "Sam"])
			.set("eav", ["0003", "lastName", "Corcos"])
			.commit()

		assert.deepStrictEqual(hoist, {
			ave: { sets: [["type", "Person", "0003"]], removes: [] },
		})
	})
})
