import { strict as assert } from "assert"
import * as _ from "lodash"
import { describe, it } from "mocha"
import { MAX, MIN, TupleValuePair } from "../storage/types"
import { sortedValues } from "../test/fixtures"
import { remove, scan, set } from "./sortedTupleValuePairs"

describe("sortedTupleValuePairs", () => {
	it("inserts in correct order", () => {
		for (let i = 0; i < 10; i++) {
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
			const data: TupleValuePair[] = []
			for (const [key, value] of _.shuffle(items)) {
				set(data, key, value)
			}
			assert.deepEqual(data, items)
		}
	})

	it("removes items correctly", () => {
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
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}
		assert.deepEqual(data, items)

		remove(data, ["a", "a", "c"])
		remove(data, ["a", "c", "a"])
		remove(data, ["a", "b", "b"])

		assert.deepEqual(data, [
			[["a", "a", "a"], 1],
			[["a", "a", "b"], 2],
			[["a", "b", "a"], 4],
			[["a", "b", "c"], 6],
			[["a", "c", "b"], 8],
			[["a", "c", "c"], 9],
		])
	})

	it("works with deep-compare", () => {
		const items: TupleValuePair[] = [
			[["a", { b: "c" }], 0],
			[["a", { uuid: "a" }], 0],
			[["a", { uuid: "v" }], 0],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}
		assert.deepEqual(data, items)

		remove(data, ["a", { uuid: "a" }])
		remove(data, ["a", { b: "c" }])

		assert.deepEqual(data.length, 1)
	})

	it("scan gt", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}
		assert.deepEqual(data, items)

		const result = scan(data, {
			gt: ["a", "a", MAX],
		})

		assert.deepEqual(result, [
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		])
	})

	it("scan gt/lt", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}
		assert.deepEqual(data, items)

		const result = scan(data, {
			gt: ["a", "a", MAX],
			lt: ["a", "c", MIN],
		})

		assert.deepEqual(result, [
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
		])
	})

	it("scan gte", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}
		assert.deepEqual(data, items)

		const result = scan(data, {
			gte: ["a", "b"],
		})

		assert.deepEqual(result, [
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		])
	})

	it("scan gte/lte", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}
		assert.deepEqual(data, items)

		const result = scan(data, {
			gte: ["a", "a", "c"],
			lte: ["a", "c", MAX],
		})

		assert.deepEqual(result, [
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		])
	})

	it("scan sorted gt", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}

		assert.deepEqual(data, items)

		const result = scan(data, {
			gt: ["a", "b", MAX],
		})

		assert.deepEqual(result, [
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		])
	})

	it("scan sorted gt/lt", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}

		assert.deepEqual(data, items)

		const result = scan(data, {
			gt: ["a", "a", MAX],
			lt: ["a", "b", MAX],
		})

		assert.deepEqual(result, [
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
		])
	})

	it("scan sorted gte", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}

		assert.deepEqual(data, items)

		const result = scan(data, {
			gte: ["a", "b"],
		})

		assert.deepEqual(result, [
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		])
	})

	it("scan sorted gte/lte", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}

		assert.deepEqual(data, items)

		const result = scan(data, {
			gte: ["a", "a", "c"],
			lte: ["a", "b", MAX],
		})

		assert.deepEqual(result, [
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
		])
	})

	it("scan invalid bounds", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
			[["a", "b", "a"], 3],
			[["a", "b", "b"], 4],
			[["a", "b", "c"], 5],
			[["a", "c", "a"], 6],
			[["a", "c", "b"], 7],
			[["a", "c", "c"], 8],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}

		assert.deepEqual(data, items)

		try {
			scan(data, {
				gte: ["a", "c"],
				lte: ["a", "a"],
			})
			assert.fail("Should fail.")
		} catch (error) {
			assert.ok(error)
		}
	})

	it("stores all types of values", () => {
		const items: TupleValuePair[] = sortedValues.map(
			(item, i) => [[item], i] as TupleValuePair
		)
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}

		assert.deepEqual(data, items)
	})

	it("updates value for a key", () => {
		const items: TupleValuePair[] = [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 2],
		]
		const data: TupleValuePair[] = []
		for (const [key, value] of _.shuffle(items)) {
			set(data, key, value)
		}
		assert.deepEqual(data, items)

		set(data, ["a", "a", "c"], 3)
		assert.deepEqual(data, [
			[["a", "a", "a"], 0],
			[["a", "a", "b"], 1],
			[["a", "a", "c"], 3],
		])
	})
})
