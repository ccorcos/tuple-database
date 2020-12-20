import * as _ from "lodash"
import { describe, it } from "mocha"
import assert from "assert"
import {
	compareQueryValue,
	compareTuple,
	QueryTuple,
	queryValueToString,
	queryTupleToString,
} from "./compareTuple"
import { sortedValues } from "../test/fixtures"

describe("compareQueryValue", () => {
	it("sorting is correct", () => {
		for (let i = 0; i < sortedValues.length; i++) {
			for (let j = 0; j < sortedValues.length; j++) {
				assert.equal(
					compareQueryValue(sortedValues[i], sortedValues[j]),
					compareQueryValue(i, j),
					`compare(${[
						queryValueToString(sortedValues[i]),
						queryValueToString(sortedValues[j]),
					].join(",")})`
				)
			}
		}
	})
})

describe("compareTuple", () => {
	it("Sorting works for pairs in-order.", () => {
		const test = (a: QueryTuple, b: QueryTuple, value: number) => {
			assert.equal(
				compareTuple([1, 1])(a, b),
				value,
				`compare(${[queryTupleToString(a), queryTupleToString(b)].join(", ")})`
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
			const tuple: QueryTuple = [
				sortedValues[i],
				sortedValues[j],
				sortedValues[k],
			]
			const rank = i * x * x + j * x + k
			return { tuple, rank }
		}

		// (40*40*40)^2 = 4 billion variations for these sorted 3-length tuples.
		for (let iter = 0; iter < 100_000; iter++) {
			const a = sample()
			const b = sample()
			assert.equal(
				compareTuple([1, 1, 1])(a.tuple, b.tuple),
				compareQueryValue(a.rank, b.rank),
				`compare(${[
					queryTupleToString(a.tuple),
					queryTupleToString(b.tuple),
				].join(", ")})`
			)
		}
	})
})
