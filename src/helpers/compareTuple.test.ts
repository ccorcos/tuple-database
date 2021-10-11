import { strict as assert } from "assert"
import * as _ from "lodash"
import { shuffle } from "lodash"
import { describe, it } from "mocha"
import { Tuple } from "../storage/types"
import { sortedValues } from "../test/fixtures"
import {
	compareTuple,
	compareValue,
	TupleToString,
	ValueToString,
} from "./compareTuple"

describe("compareValue", () => {
	it("sorting is correct", () => {
		for (let i = 0; i < sortedValues.length; i++) {
			for (let j = 0; j < sortedValues.length; j++) {
				assert.equal(
					compareValue(sortedValues[i], sortedValues[j]),
					compareValue(i, j),
					`compare(${[
						ValueToString(sortedValues[i]),
						ValueToString(sortedValues[j]),
					].join(",")})`
				)
			}
		}
	})

	it("sorts class objects properly", () => {
		class A {}

		const values = shuffle([
			{ a: 1 },
			{ a: 2 },
			{ b: -1 },
			new A(),
			new A(),
		]).sort(compareValue)

		assert.deepEqual(values[0], { a: 1 })
		assert.deepEqual(values[1], { a: 2 })
		assert.deepEqual(values[2], { b: -1 })
		assert.ok(values[3] instanceof A)
		assert.ok(values[4] instanceof A)
	})
})

describe("compareTuple", () => {
	it("Sorting works for pairs in-order.", () => {
		const test = (a: Tuple, b: Tuple, value: number) => {
			assert.equal(
				compareTuple(a, b),
				value,
				`compare(${[TupleToString(a), TupleToString(b)].join(", ")})`
			)
		}

		// Ensure it works for all pairwise tuples.
		for (let i = 0; i < sortedValues.length - 1; i++) {
			const a = sortedValues[i]
			const b = sortedValues[i + 1]
			test([a, a], [a, b], -1)
			test([a, b], [b, a], -1)
			test([b, a], [b, b], -1)
			test([a, a], [a, a], 0)
			test([b, b], [b, b], 0)
		}
	})

	it("Sorting does a true deep-compare", () => {
		const test = (a: Tuple, b: Tuple, value: number) => {
			assert.equal(
				compareTuple(a, b),
				value,
				`compare(${[TupleToString(a), TupleToString(b)].join(", ")})`
			)
		}

		test(["a", { a: { b: "c" } }], ["a", { a: { b: "c" } }], 0)
	})

	it("3-length tuple sorting is correct (sampled)", () => {
		const sample = () => {
			const x = sortedValues.length
			const i = _.random(x - 1)
			const j = _.random(x - 1)
			const k = _.random(x - 1)
			const tuple: Tuple = [sortedValues[i], sortedValues[j], sortedValues[k]]
			const rank = i * x * x + j * x + k
			return { tuple, rank }
		}

		// (40*40*40)^2 = 4 billion variations for these sorted 3-length tuples.
		for (let iter = 0; iter < 100_000; iter++) {
			const a = sample()
			const b = sample()
			assert.equal(
				compareTuple(a.tuple, b.tuple),
				compareValue(a.rank, b.rank),
				`compare(${[TupleToString(a.tuple), TupleToString(b.tuple)].join(
					", "
				)})`
			)
		}
	})
})
