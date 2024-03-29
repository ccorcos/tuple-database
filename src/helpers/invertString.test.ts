import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { invertString } from "./invertString"

describe("invertString", () => {
	const data = [
		"aaa",
		"aab",
		"aac",
		"aba",
		"abc",
		"aca",
		"acc",
		"bbb",
		"bca",
		"bcb",
		"caa",
		"cab",
		"ccc",
	]

	it("can encode and decode properly", () => {
		for (const str of data) {
			assert.strictEqual(invertString(invertString(str)), str)
		}
	})

	it("inversion is reverse sorted", () => {
		const sorted = [...data].sort()
		assert.deepStrictEqual(sorted, data)

		const inverseSorted = sorted.map(invertString).sort().map(invertString)
		assert.deepStrictEqual(inverseSorted, sorted.reverse())
	})
})
