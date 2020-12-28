import { describe, it } from "mocha"
import assert from "assert"
import { invertString } from "./invertString"
import { compare } from "./compare"
import { invert } from "lodash"

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
