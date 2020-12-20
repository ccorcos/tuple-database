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
			const test = (tuple: QueryTuple) => {
				const encoded = encodeQueryTuple(tuple)
				const decoded = decodeQueryTuple(encoded)
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
				for (let j = 0; j < sortedValues.length; j++) {
					const b = sortedValues[j]
					test([a, b])
				}
			}

			for (let i = 0; i < sortedValues.length - 2; i++) {
				const opts = sortedValues.slice(i, i + 3)
				for (const a of opts) {
					for (const b of opts) {
						for (const c of opts) {
							test([a, b, c] as any)
						}
					}
				}
			}
		})

		it("Encodes in lexicographical order", () => {
			const test = (aTuple: QueryTuple, bTuple: QueryTuple, result: number) => {
				const a = encodeQueryTuple(aTuple)
				const b = encodeQueryTuple(bTuple)
				assert.deepStrictEqual(
					compare(a, b),
					result,
					`compareQueryTuple(${[
						queryTupleToString(aTuple),
						queryTupleToString(bTuple),
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
					test([a, a], [a, b], compare(i, j))
					test([a, b], [b, a], compare(i, j))
					test([b, a], [b, b], compare(i, j))
					if (i !== j) {
						test([a], [a, a], -1)
						test([a], [a, b], -1)
						test([a], [b, a], compare(i, j))
						test([a], [b, b], compare(i, j))
						test([b], [a, a], compare(j, i))
						test([b], [a, b], compare(j, i))
						test([b], [b, a], -1)
						test([b], [b, b], -1)
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
				test(a.tuple, b.tuple, compare(a.rank, b.rank))
			}
		})
	})
})
