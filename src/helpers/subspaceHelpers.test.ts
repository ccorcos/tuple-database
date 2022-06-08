import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { MAX } from "../storage/types"
import {
	normalizeSubspaceScanArgs,
	prependPrefixToWriteOps,
	removePrefixFromWriteOps,
} from "./subspaceHelpers"

describe("subspaceHelpers", () => {
	describe("prependPrefixToWrites", () => {
		it("works", () => {
			assert.deepEqual(
				prependPrefixToWriteOps(["x"], {
					set: [
						{ key: ["a"], value: 1 },
						{ key: ["b"], value: 2 },
					],
					remove: [["c"]],
				}),
				{
					set: [
						{ key: ["x", "a"], value: 1 },
						{ key: ["x", "b"], value: 2 },
					],
					remove: [["x", "c"]],
				}
			)
		})
	})

	describe("removePrefixFromWrites", () => {
		it("works", () => {
			assert.deepEqual(
				removePrefixFromWriteOps(["x"], {
					set: [
						{ key: ["x", "a"], value: 1 },
						{ key: ["x", "b"], value: 2 },
					],
					remove: [["x", "c"]],
				}),
				{
					set: [
						{ key: ["a"], value: 1 },
						{ key: ["b"], value: 2 },
					],
					remove: [["c"]],
				}
			)
		})
		it("throws if its the wrong prefix", () => {
			assert.throws(() => {
				removePrefixFromWriteOps(["y"], {
					set: [
						{ key: ["x", "a"], value: 1 },
						{ key: ["x", "b"], value: 2 },
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
