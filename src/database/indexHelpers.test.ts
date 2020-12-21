import * as _ from "lodash"
import { describe, it } from "mocha"
import * as assert from "assert"
import { scan, remove, set } from "./indexHelpers"
import { MAX, MIN, Tuple } from "./types"
import { sortedValues } from "../test/fixtures"

describe("indexHelpers", () => {
	it("inserts in correct order", () => {
		for (let i = 0; i < 10; i++) {
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
			const data: Array<Tuple> = []
			for (const item of _.shuffle(items)) {
				set(data, item)
			}
			assert.deepEqual(data, items)
		}
	})

	it("removes items correctly", () => {
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}
		assert.deepEqual(data, items)

		remove(data, ["a", "a", "c"])
		remove(data, ["a", "c", "a"])
		remove(data, ["a", "b", "b"])

		assert.deepEqual(data, [
			["a", "a", "a"],
			["a", "a", "b"],
			["a", "b", "a"],
			["a", "b", "c"],
			["a", "c", "b"],
			["a", "c", "c"],
		])
	})

	it("scan gt", () => {
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}
		assert.deepEqual(data, items)

		const result = scan(data, {
			gt: ["a", "a", MAX],
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}
		assert.deepEqual(data, items)

		const result = scan(data, {
			gt: ["a", "a", MAX],
			lt: ["a", "c", MIN],
		})

		assert.deepEqual(result, [
			["a", "b", "a"],
			["a", "b", "b"],
			["a", "b", "c"],
		])
	})

	it("scan gte", () => {
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}
		assert.deepEqual(data, items)

		const result = scan(data, {
			gte: ["a", "b"],
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}
		assert.deepEqual(data, items)

		const result = scan(data, {
			gte: ["a", "a", "c"],
			lte: ["a", "c", MAX],
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}

		assert.deepEqual(data, items)

		const result = scan(data, {
			gt: ["a", "b", MAX],
		})

		assert.deepEqual(result, [
			["a", "c", "a"],
			["a", "c", "b"],
			["a", "c", "c"],
		])
	})

	it("scan sorted gt/lt", () => {
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}

		assert.deepEqual(data, items)

		const result = scan(data, {
			gt: ["a", "a", MAX],
			lt: ["a", "b", MAX],
		})

		assert.deepEqual(result, [
			["a", "b", "a"],
			["a", "b", "b"],
			["a", "b", "c"],
		])
	})

	it("scan sorted gte", () => {
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}

		assert.deepEqual(data, items)

		const result = scan(data, {
			gte: ["a", "b"],
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

	it("scan sorted gte/lte", () => {
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}

		assert.deepEqual(data, items)

		const result = scan(data, {
			gte: ["a", "a", "c"],
			lte: ["a", "b", MAX],
		})

		assert.deepEqual(result, [
			["a", "a", "c"],
			["a", "b", "a"],
			["a", "b", "b"],
			["a", "b", "c"],
		])
	})

	it("scan invalid bounds", () => {
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
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
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
		const items: Array<Tuple> = sortedValues.map((item) => [item])
		const data: Array<Tuple> = []
		for (const item of _.shuffle(items)) {
			set(data, item)
		}

		assert.deepEqual(data, items)
	})
})
