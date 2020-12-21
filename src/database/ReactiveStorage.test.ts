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

		let hoist: Writes | undefined
		store.subscribe(
			index,
			{ gt: ["a", "a", MAX], lt: ["a", "c", MIN] },
			(writes) => {
				hoist = writes
			}
		)

		store.transact().set(index, ["a", "c", 1]).commit()

		// TODO: we should use a proper prefix query here. Then we wouldn't
		// have to try to determine it from the gt/lt business.
		// {
		// 	abc: { sets: [["a", "c", 1]], removes: [] },
		// }
		assert.deepStrictEqual(hoist, undefined)
	})
})
