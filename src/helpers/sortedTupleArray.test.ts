import { strict as assert } from "assert"
import * as _ from "lodash"
import { describe, it } from "mocha"
import { MAX, MIN, Tuple } from "../storage/types"
import { scan, set } from "./sortedTupleArray"

describe("sortedTupleArray", () => {
	describe("prefix basics", () => {
		const items: Tuple[] = [
			[],
			["a"],
			["a", "a"],
			["a", "b"],
			["b"],
			["b", "a"],
			["b", "b"],
		]

		it("sorts prefixes in the correct order", () => {
			const data: Tuple[] = []
			for (const item of _.shuffle(items)) {
				set(data, item)
			}
			assert.deepEqual(data, items)
		})

		it("prefix", () => {
			const result = scan(items, { prefix: ["a"] })
			assert.deepEqual(result, [["a"], ["a", "a"], ["a", "b"]])
		})

		it("prefix limit", () => {
			const result = scan(items, { prefix: ["a"], limit: 2 })
			assert.deepEqual(result, [["a"], ["a", "a"]])
		})

		it("prefix limit truncated", () => {
			const result = scan(items, { prefix: ["a"], limit: 10 })
			assert.deepEqual(result, [["a"], ["a", "a"], ["a", "b"]])
		})

		it("prefix reverse", () => {
			const result = scan(items, { prefix: ["a"], reverse: true })
			assert.deepEqual(result, [["a", "b"], ["a", "a"], ["a"]])
		})

		it("prefix reverse limit", () => {
			const result = scan(items, { prefix: ["a"], limit: 2, reverse: true })
			assert.deepEqual(result, [
				["a", "b"],
				["a", "a"],
			])
		})

		it("prefix reverse limit truncated", () => {
			const result = scan(items, { prefix: ["a"], limit: 10, reverse: true })
			assert.deepEqual(result, [["a", "b"], ["a", "a"], ["a"]])
		})
	})

	describe("bounds", () => {
		const items: Tuple[] = [
			[],
			["a"],
			["a", "a"],
			["a", "b"],
			["a", "c"],
			["b"],
			["b", "a"],
			["b", "b"],
			["b", "c"],
		]

		it("prefix gt MIN", () => {
			const result = scan(items, { prefix: ["a"], gt: [MIN] })
			assert.deepEqual(result, [
				["a", "a"],
				["a", "b"],
				["a", "c"],
			])
		})

		it("prefix gt MIN reverse", () => {
			const result = scan(items, { prefix: ["a"], gt: [MIN], reverse: true })
			assert.deepEqual(result, [
				["a", "c"],
				["a", "b"],
				["a", "a"],
			])
		})

		it("prefix gt", () => {
			const result = scan(items, { prefix: ["a"], gt: ["a"] })
			assert.deepEqual(result, [
				["a", "b"],
				["a", "c"],
			])
		})

		it("prefix gt reverse", () => {
			const result = scan(items, { prefix: ["a"], gt: ["a"], reverse: true })
			assert.deepEqual(result, [
				["a", "c"],
				["a", "b"],
			])
		})

		it("prefix lt MAX", () => {
			const result = scan(items, { prefix: ["a"], lt: [MAX] })
			assert.deepEqual(result, [["a"], ["a", "a"], ["a", "b"], ["a", "c"]])
		})

		it("prefix lt MAX reverse", () => {
			const result = scan(items, { prefix: ["a"], lt: [MAX], reverse: true })
			assert.deepEqual(result, [["a", "c"], ["a", "b"], ["a", "a"], ["a"]])
		})

		it("prefix lt", () => {
			const result = scan(items, { prefix: ["a"], lt: ["c"] })
			assert.deepEqual(result, [["a"], ["a", "a"], ["a", "b"]])
		})

		it("prefix lt reverse", () => {
			const result = scan(items, { prefix: ["a"], lt: ["c"], reverse: true })
			assert.deepEqual(result, [["a", "b"], ["a", "a"], ["a"]])
		})
	})
})
