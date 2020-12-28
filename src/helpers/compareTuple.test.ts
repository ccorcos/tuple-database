import * as _ from "lodash"
import { describe, it } from "mocha"
import assert from "assert"
import {
	compareValue,
	compareTuple,
	ValueToString,
	TupleToString,
} from "./compareTuple"
import { sortedValues } from "../test/fixtures"
import { Tuple } from "../types"

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
		}
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
