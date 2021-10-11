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

	describe("prefix composition", () => {
		const items: Tuple[] = [
			["a", "a", "a"],
			["a", "a", "b"],
			["a", "a", "c"],
			["a", "b", "a"],
			["a", "b", "b"],
			["a", "b", "c"],
			["a", "c", "a"],
			["a", "c", "b"],
			["a", "c", "c"],
			["b", "a", "a"],
			["b", "a", "b"],
			["b", "a", "c"],
			["b", "b", "a"],
			["b", "b", "b"],
			["b", "b", "c"],
			["b", "c", "a"],
			["b", "c", "b"],
			["b", "c", "c"],
		]

		it("prefix gt", () => {
			const result = scan(items, { prefix: ["a"], gt: ["a", MAX] })
			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			])
		})

		it("prefix gt reverse", () => {
			const result = scan(items, {
				prefix: ["a"],
				gt: ["a", MAX],
				reverse: true,
			})
			assert.deepEqual(
				result,
				[
					["a", "b", "a"],
					["a", "b", "b"],
					["a", "b", "c"],
					["a", "c", "a"],
					["a", "c", "b"],
					["a", "c", "c"],
				].reverse()
			)
		})

		it("prefix lt", () => {
			const result = scan(items, { prefix: ["a"], lt: ["b"] })
			assert.deepEqual(result, [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
			])
		})

		it("prefix lt reverse", () => {
			const result = scan(items, { prefix: ["a"], lt: ["b"], reverse: true })
			assert.deepEqual(
				result,
				[
					["a", "a", "a"],
					["a", "a", "b"],
					["a", "a", "c"],
				].reverse()
			)
		})

		it("prefix gt/lt", () => {
			const result = scan(items, { prefix: ["a"], gt: ["a", MAX], lt: ["c"] })
			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
			])
		})

		it("prefix gt/lt reverse", () => {
			const result = scan(items, {
				prefix: ["a"],
				gt: ["a", MAX],
				lt: ["c"],
				reverse: true,
			})
			assert.deepEqual(
				result,
				[
					["a", "b", "a"],
					["a", "b", "b"],
					["a", "b", "c"],
				].reverse()
			)
		})

		it("prefix gte", () => {
			const result = scan(items, { prefix: ["a"], gte: ["b"] })
			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			])
		})

		it("prefix gte reverse", () => {
			const result = scan(items, { prefix: ["a"], gte: ["b"], reverse: true })
			assert.deepEqual(
				result,
				[
					["a", "b", "a"],
					["a", "b", "b"],
					["a", "b", "c"],
					["a", "c", "a"],
					["a", "c", "b"],
					["a", "c", "c"],
				].reverse()
			)
		})

		it("prefix lte", () => {
			const result = scan(items, { prefix: ["a"], lte: ["a", MAX] })
			assert.deepEqual(result, [
				["a", "a", "a"],
				["a", "a", "b"],
				["a", "a", "c"],
			])
		})

		it("prefix lte reverse", () => {
			const result = scan(items, {
				prefix: ["a"],
				lte: ["a", MAX],
				reverse: true,
			})
			assert.deepEqual(
				result,
				[
					["a", "a", "a"],
					["a", "a", "b"],
					["a", "a", "c"],
				].reverse()
			)
		})

		it("prefix gte/lte", () => {
			const result = scan(items, { prefix: ["a"], gte: ["b"], lte: ["c", MAX] })
			assert.deepEqual(result, [
				["a", "b", "a"],
				["a", "b", "b"],
				["a", "b", "c"],
				["a", "c", "a"],
				["a", "c", "b"],
				["a", "c", "c"],
			])
		})

		it("prefix gte/lte reverse", () => {
			const result = scan(items, {
				prefix: ["a"],
				gte: ["b"],
				lte: ["c", MAX],
				reverse: true,
			})
			assert.deepEqual(
				result,
				[
					["a", "b", "a"],
					["a", "b", "b"],
					["a", "b", "c"],
					["a", "c", "a"],
					["a", "c", "b"],
					["a", "c", "c"],
				].reverse()
			)
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
