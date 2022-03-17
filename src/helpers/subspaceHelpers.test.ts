import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { MAX } from "../storage/types"
import {
	normalizeSubspaceScanArgs,
	prependPrefixToWrites,
	removePrefixFromWrites,
} from "./subspaceHelpers"

describe("subspaceHelpers", () => {
	describe("prependPrefixToWrites", () => {
		it("works", () => {
			assert.deepEqual(
				prependPrefixToWrites(["x"], {
					set: [
						[["a"], 1],
						[["b"], 2],
					],
					remove: [["c"]],
				}),
				{
					set: [
						[["x", "a"], 1],
						[["x", "b"], 2],
					],
					remove: [["x", "c"]],
				}
			)
		})
	})

	describe("removePrefixFromWrites", () => {
		it("works", () => {
			assert.deepEqual(
				removePrefixFromWrites(["x"], {
					set: [
						[["x", "a"], 1],
						[["x", "b"], 2],
					],
					remove: [["x", "c"]],
				}),
				{
					set: [
						[["a"], 1],
						[["b"], 2],
					],
					remove: [["c"]],
				}
			)
		})
		it("throws if its the wrong prefix", () => {
			assert.throws(() => {
				removePrefixFromWrites(["y"], {
					set: [
						[["x", "a"], 1],
						[["x", "b"], 2],
					],
					remove: [["x", "c"]],
				})
			})
		})
	})

	describe("normalizeSubspaceScanArgs", () => {
		it("works", () => {
			assert.deepEqual(
				normalizeSubspaceScanArgs([1], { prefix: [2], gt: [3] }),
				{ gt: [1, 2, 3], lte: [1, 2, MAX] }
			)
		})
	})
})
