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
})
