import { strict as assert } from "assert"
import * as _ from "lodash"
import { describe, it } from "mocha"
import { KeyValuePair } from "../storage/types"
import { get, remove, scan, set } from "./sortedTupleValuePairs"

describe("sortedTupleValuePairs", () => {
	const items: KeyValuePair[] = [
		{ key: [], value: 0 },
		{ key: ["a"], value: 1 },
		{ key: ["a", "a"], value: 2 },
		{ key: ["a", "b"], value: 3 },
		{ key: ["b"], value: 4 },
		{ key: ["b", "a"], value: 5 },
		{ key: ["b", "b"], value: 6 },
	]

	it("sorts prefixes in the correct order", () => {
		const data: KeyValuePair[] = []
		for (const { key, value } of _.shuffle(items)) {
			set(data, key, value)
		}
		assert.deepEqual(data, items)
	})

	it("set will replace a value", () => {
		const data = [...items]
		set(data, ["b"], 99)
		assert.deepEqual(data, [
			{ key: [], value: 0 },
			{ key: ["a"], value: 1 },
			{ key: ["a", "a"], value: 2 },
			{ key: ["a", "b"], value: 3 },
			{ key: ["b"], value: 99 },
			{ key: ["b", "a"], value: 5 },
			{ key: ["b", "b"], value: 6 },
		])
	})

	it("remove", () => {
		const data = [...items]
		remove(data, ["b"])
		assert.deepEqual(data, [
			{ key: [], value: 0 },
			{ key: ["a"], value: 1 },
			{ key: ["a", "a"], value: 2 },
			{ key: ["a", "b"], value: 3 },
			{ key: ["b", "a"], value: 5 },
			{ key: ["b", "b"], value: 6 },
		])
	})

	it("get", () => {
		const data = [...items]
		const result = get(data, ["b"])
		assert.deepEqual(result, 4)
	})

	// NOTE: this logic is well tested in sortedList.test.ts and sortedTupleArray.test.ts
	// This is just a smoke test because there is some stuff going on with the bounds adjustment.
	it("scan prefix", () => {
		const result = scan(items, { prefix: ["a"] })
		assert.deepEqual(result, [
			{ key: ["a"], value: 1 },
			{ key: ["a", "a"], value: 2 },
			{ key: ["a", "b"], value: 3 },
		])
	})

	it("scan gt", () => {
		const result = scan(items, { gt: ["a", "a"] })
		assert.deepEqual(result, [
			{ key: ["a", "b"], value: 3 },
			{ key: ["b"], value: 4 },
			{ key: ["b", "a"], value: 5 },
			{ key: ["b", "b"], value: 6 },
		])
	})

	const reversed = [...items].reverse()

	it("set reverse", () => {
		const data: KeyValuePair[] = []
		for (const { key, value } of _.shuffle(items)) {
			set(data, key, value, true)
		}
		assert.deepEqual(data, reversed)
	})

	it("remove reverse", () => {
		First: {
			const data: KeyValuePair[] = []

			set(data, [1], null, true)
			set(data, [2], null, true)
			set(data, [3], null, true)

			remove(data, [1], true)
			assert.deepEqual(data, [
				{ key: [3], value: null },
				{ key: [2], value: null },
			])
		}

		Middle: {
			const data: KeyValuePair[] = []

			set(data, [1], null, true)
			set(data, [2], null, true)
			set(data, [3], null, true)

			remove(data, [2], true)
			assert.deepEqual(data, [
				{ key: [3], value: null },
				{ key: [1], value: null },
			])
		}

		Last: {
			const data: KeyValuePair[] = []

			set(data, [1], null, true)
			set(data, [2], null, true)
			set(data, [3], null, true)

			remove(data, [1], true)
			assert.deepEqual(data, [
				{ key: [3], value: null },
				{ key: [2], value: null },
			])
		}
	})
})
