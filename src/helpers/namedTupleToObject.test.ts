import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { Assert } from "../database/typeHelpers"
import { namedTupleToObject } from "./namedTupleToObject"

describe("namedTupleToObject", () => {
	it("works", () => {
		const tuple = ["hello", { a: 1 }, { b: ["c"] }] as [
			"hello",
			{ a: 1 },
			{ b: string[] }
		]
		const obj = namedTupleToObject(tuple)
		type X = Assert<typeof obj, { a: 1; b: string[] }>
		assert.deepEqual(obj, { a: 1, b: ["c"] })
	})
})
