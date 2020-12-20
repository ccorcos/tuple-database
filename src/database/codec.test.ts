import * as _ from "lodash"
import { describe, it } from "mocha"
import * as assert from "assert"
import { sortedValues } from "../test/fixtures"
import {
	encodeQueryValue,
	decodeQueryValue,
	decodeQueryTuple,
	encodeQueryTuple,
} from "./codec"
import { compare } from "../helpers/compare"
import {
	queryValueToString,
	QueryTuple,
	queryTupleToString,
} from "./compareTuple"
import { Sort } from "./types"

describe("codec", () => {
	describe("encodeQueryValue", () => {
		it("Encodes and decodes properly", () => {
			for (let i = 0; i < sortedValues.length; i++) {
				const value = sortedValues[i]
				const encoded = encodeQueryValue(value)
				const decoded = decodeQueryValue(encoded)

				assert.deepStrictEqual(
					decoded,
					value,
					[
						queryValueToString(value),
						queryValueToString(encoded),
						queryValueToString(decoded),
					].join(" -> ")
				)
			}
		})

		it("Encodes in lexicographical order", () => {
			for (let i = 0; i < sortedValues.length; i++) {
				for (let j = 0; j < sortedValues.length; j++) {
					const a = encodeQueryValue(sortedValues[i])
					const b = encodeQueryValue(sortedValues[j])
					assert.deepStrictEqual(
						compare(a, b),
						compare(i, j),
						`compareQueryValue(${[
							queryValueToString(sortedValues[i]),
							queryValueToString(sortedValues[j]),
						].join(", ")}) === compare(${[
							JSON.stringify(a),
							JSON.stringify(b),
						].join(", ")})`
					)
				}
			}
		})
	})

	describe("encodeQueryTuple", () => {
		it("Encodes and decodes properly", () => {
			const test = (tuple: QueryTuple, sort: Sort = []) => {
				const encoded = encodeQueryTuple(tuple, sort)
				const decoded = decodeQueryTuple(encoded, sort)
				assert.deepStrictEqual(
					decoded,
					tuple,
					[
						queryTupleToString(tuple),
						queryValueToString(encoded),
						queryTupleToString(decoded),
					].join(" -> ")
				)
			}
			test([])
			for (let i = 0; i < sortedValues.length; i++) {
				const a = sortedValues[i]
				test([a])
				test([a], [-1])
				for (let j = 0; j < sortedValues.length; j++) {
					const b = sortedValues[j]
					test([a, b])
					test([a, b], [1, -1])
				}
			}

			for (let i = 0; i < sortedValues.length - 2; i++) {
				const opts = sortedValues.slice(i, i + 3)
				for (const a of opts) {
					for (const b of opts) {
						for (const c of opts) {
							test([a, b, c])
							test([a, b, c], [-1, 1, -1])
						}
					}
				}
			}
		})

		it("Encodes in lexicographical order", () => {
			const test = (
				aTuple: QueryTuple,
				bTuple: QueryTuple,
				sort: Sort,
				result: number
			) => {
				const a = encodeQueryTuple(aTuple, sort)
				const b = encodeQueryTuple(bTuple, sort)
				assert.deepStrictEqual(
					compare(a, b),
					result,
					`compareQueryTuple(${[
						queryTupleToString(aTuple),
						queryTupleToString(bTuple),
						JSON.stringify(sort),
					].join(", ")}) === compare(${[
						JSON.stringify(a),
						JSON.stringify(b),
					].join(", ")})`
				)
			}

			for (let i = 0; i < sortedValues.length; i++) {
				for (let j = 0; j < sortedValues.length; j++) {
					const a = sortedValues[i]
					const b = sortedValues[j]
					test([a, a], [a, b], [1, 1], compare(i, j))
					test([a, a], [a, b], [1, -1], not(compare(i, j)))
					test([a, a], [a, b], [-1, 1], compare(i, j))

					test([a, b], [b, a], [1, 1], compare(i, j))
					test([a, b], [b, a], [1, -1], compare(i, j))
					test([a, b], [b, a], [-1, 1], not(compare(i, j)))

					test([b, a], [b, b], [1, 1], compare(i, j))
					if (i !== j) {
						test([a], [a, a], [1, 1], -1)
						test([a], [a, b], [1, 1], -1)
						test([a], [b, a], [1, 1], compare(i, j))
						test([a], [b, b], [1, 1], compare(i, j))
						test([b], [a, a], [1, 1], compare(j, i))
						test([b], [a, b], [1, 1], compare(j, i))
						test([b], [b, a], [1, 1], -1)
						test([b], [b, b], [1, 1], -1)
					}
				}
			}

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
				test(a.tuple, b.tuple, [1, 1, 1], compare(a.rank, b.rank))
			}
		})
	})
})

function not(x: number) {
	return x === 0 ? x : -1 * x
}
