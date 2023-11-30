import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { KeyValueDatabase } from "./kv"

describe("KeyValueDatabase", () => {
	it("read/write", () => {
		const kv = new KeyValueDatabase()

		let result = kv.get("a")
		assert.deepEqual(result, { value: undefined, version: 0 })

		kv.write({ set: [{ key: "a", value: 1 }] })
		result = kv.get("a")
		assert.deepEqual(result, { value: 1, version: 1 })
	})

	it("conflict", () => {
		const kv = new KeyValueDatabase()
		kv.write({ set: [{ key: "a", value: 1 }] })

		const a = kv.get("a")
		kv.write({ set: [{ key: "a", value: 2 }] })
		assert.throws(() => {
			kv.write({
				check: [{ key: "a", version: a.version }],
				set: [{ key: "b", value: a.value * 2 }],
			})
		})
	})

	it("sum", () => {
		const kv = new KeyValueDatabase()
		kv.write({ sum: [{ key: "a", value: 1 }] })
		assert.deepEqual(kv.get("a"), { value: 1, version: 1 })
		kv.write({ sum: [{ key: "a", value: 1 }] })
		assert.deepEqual(kv.get("a"), { value: 2, version: 2 })
	})
})
