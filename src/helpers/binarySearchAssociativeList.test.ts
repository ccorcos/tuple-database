/*

	Binary Search Tests.
	./node_modules/.bin/mocha -r ts-node/register ./src/helpers/binarySearch.test.ts

*/

import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { binarySearchAssociativeList } from "./binarySearchAssociativeList"
import { compare } from "./compare"

describe("binarySearchAssociativeList", () => {
	// An associative array.
	const list = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
		(n) => [n, {}] as [number, any]
	)
	it("find before", () => {
		const result = binarySearchAssociativeList(list, -1, compare)
		assert.equal(result.found, undefined)
		assert.equal(result.closest, 0)
	})
	it("find after", () => {
		const result = binarySearchAssociativeList(list, 10, compare)
		assert.equal(result.found, undefined)
		assert.equal(result.closest, 10)
	})
	it("find middle", () => {
		const result = binarySearchAssociativeList(list, 1.5, compare)
		assert.equal(result.found, undefined)
		assert.equal(result.closest, 2)
	})
	it("find exact", () => {
		const result = binarySearchAssociativeList(list, 5, compare)
		assert.equal(result.found, 5)
		assert.equal(result.closest, undefined)
	})
})
