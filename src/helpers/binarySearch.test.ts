/*

	Binary Search Tests.
	./node_modules/.bin/mocha -r ts-node/register ./src/helpers/binarySearch.test.ts

*/

import { describe, it } from "mocha"
import assert from "assert"
import { binarySearch } from "./binarySearch"
import { compare } from "./compare"

describe("binarySearch", () => {
	const list = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
	it("find before", () => {
		const result = binarySearch(list, -1, compare)
		assert.equal(result.found, undefined)
		assert.equal(result.closest, 0)
	})
	it("find after", () => {
		const result = binarySearch(list, 10, compare)
		assert.equal(result.found, undefined)
		assert.equal(result.closest, 10)
	})
	it("find middle", () => {
		const result = binarySearch(list, 1.5, compare)
		assert.equal(result.found, undefined)
		assert.equal(result.closest, 2)
	})
	it("find exact", () => {
		const result = binarySearch(list, 5, compare)
		assert.equal(result.found, 5)
		assert.equal(result.closest, undefined)
	})
})
