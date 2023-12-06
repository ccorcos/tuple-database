import { strict as assert } from "assert"
import { jsonCodec } from "lexicodec"
import { describe, it } from "mocha"
import { TupleOrderedKeyValueDatabase } from "./tuple-okv"

describe("TupleOrderedKeyValueDatabase", () => {
	it("get", () => {
		const okv = new TupleOrderedKeyValueDatabase(jsonCodec)

		let result = okv.get(["a"])
		assert.deepEqual(result?.value, undefined)

		okv.write({ set: [{ key: ["a"], value: 1 }] })
		result = okv.get(["a"])
		assert.deepEqual(result?.value, 1)
	})

	it("list", () => {
		const okv = new TupleOrderedKeyValueDatabase(jsonCodec)

		okv.write({
			set: [
				{ key: ["a"], value: 0 },
				{ key: ["a", "a"], value: 0 },
				{ key: ["a", "b"], value: 0 },
				{ key: ["a", "c"], value: 0 },
				{ key: ["b"], value: 0 },
				{ key: ["b", "a"], value: 0 },
				{ key: ["b", "b"], value: 0 },
				{ key: ["b", "c"], value: 0 },
			],
		})

		let result = okv.list({ prefix: ["a"] }).map(({ key }) => key)
		assert.deepEqual(result, [
			["a", "a"],
			["a", "b"],
			["a", "c"],
		])

		result = okv
			.list({ prefix: ["a"], start: ["a", "b"] })
			.map(({ key }) => key)
		assert.deepEqual(result, [
			["a", "b"],
			["a", "c"],
		])

		result = okv.list({ prefix: ["a"], end: ["a", "b"] }).map(({ key }) => key)
		assert.deepEqual(result, [["a", "a"]])

		result = okv.list({ start: ["a"], end: ["b", "b"] }).map(({ key }) => key)
		assert.deepEqual(result, [
			["a"],
			["a", "a"],
			["a", "b"],
			["a", "c"],
			["b"],
			["b", "a"],
		])

		result = okv
			.list({ start: ["a"], end: ["b", "b"], reverse: true, limit: 4 })
			.map(({ key }) => key)
		assert.deepEqual(result, [["b", "a"], ["b"], ["a", "c"], ["a", "b"]])
	})

	it("conflict", () => {
		const okv = new TupleOrderedKeyValueDatabase(jsonCodec)
		okv.write({ set: [{ key: ["a"], value: 1 }] })

		const a = okv.get(["a"])!
		okv.write({ set: [{ key: ["a"], value: 2 }] })

		assert.throws(() => {
			okv.write({
				check: [{ key: ["a"], version: a.version }],
				set: [{ key: ["b"], value: a.value * 2 }],
			})
		})
	})

	it("sum", () => {
		const okv = new TupleOrderedKeyValueDatabase(jsonCodec)
		okv.write({ sum: [{ key: ["a"], value: 1 }] })
		assert.deepEqual(okv.get(["a"])?.value, 1)
		okv.write({ sum: [{ key: ["a"], value: 1 }] })
		assert.deepEqual(okv.get(["a"])?.value, 2)
	})
})
