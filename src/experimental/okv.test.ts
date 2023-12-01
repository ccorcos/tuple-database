import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { OrderedKeyValueDatabase } from "./okv"

describe("OrderedKeyValueDatabase", () => {
	it("get", () => {
		const okv = new OrderedKeyValueDatabase()

		let result = okv.get("a")
		assert.deepEqual(result?.value, undefined)

		okv.write({ set: [{ key: "a", value: 1 }] })
		result = okv.get("a")
		assert.deepEqual(result?.value, 1)
	})

	it("list", () => {
		const okv = new OrderedKeyValueDatabase()

		okv.write({
			set: [
				{ key: "a", value: 0 },
				{ key: "aa", value: 0 },
				{ key: "ab", value: 0 },
				{ key: "ac", value: 0 },
				{ key: "b", value: 0 },
				{ key: "ba", value: 0 },
				{ key: "bb", value: 0 },
				{ key: "bc", value: 0 },
			],
		})

		let result = okv.list({ prefix: "a" }).map(({ key }) => key)
		assert.deepEqual(result, ["aa", "ab", "ac"])

		result = okv.list({ prefix: "a", start: "ab" }).map(({ key }) => key)
		assert.deepEqual(result, ["ab", "ac"])

		result = okv.list({ prefix: "a", end: "ab" }).map(({ key }) => key)
		assert.deepEqual(result, ["aa"])

		result = okv.list({ start: "a", end: "bb" }).map(({ key }) => key)
		assert.deepEqual(result, ["a", "aa", "ab", "ac", "b", "ba"])

		result = okv
			.list({ start: "a", end: "bb", reverse: true, limit: 4 })
			.map(({ key }) => key)
		assert.deepEqual(result, ["ba", "b", "ac", "ab"])
	})

	it("conflict", () => {
		const okv = new OrderedKeyValueDatabase()
		okv.write({ set: [{ key: "a", value: 1 }] })

		const a = okv.get("a")!
		okv.write({ set: [{ key: "a", value: 2 }] })

		assert.throws(() => {
			okv.write({
				check: [{ key: "a", version: a.version }],
				set: [{ key: "b", value: a.value * 2 }],
			})
		})
	})

	it("sum", () => {
		const okv = new OrderedKeyValueDatabase()
		okv.write({ sum: [{ key: "a", value: 1 }] })
		assert.deepEqual(okv.get("a")?.value, 1)
		okv.write({ sum: [{ key: "a", value: 1 }] })
		assert.deepEqual(okv.get("a")?.value, 2)
	})
})
