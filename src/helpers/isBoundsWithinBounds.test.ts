import { describe, it } from "mocha"
import { assert } from "../test/assertHelpers"
import { isBoundsWithinBounds } from "./isBoundsWithinBounds"
import { Bounds } from "./sortedTupleArray"

const testWithinBounds = (container: Bounds) => ({
	true: (bounds: Bounds) =>
		assert.equal(
			isBoundsWithinBounds({ container, bounds }),
			true,
			`${JSON.stringify(container)} should contain ${JSON.stringify(bounds)}`
		),
	false: (bounds: Bounds) =>
		assert.equal(
			isBoundsWithinBounds({ container, bounds }),
			false,
			`${JSON.stringify(container)} should NOT contain ${JSON.stringify(
				bounds
			)}`
		),
})

describe("isBoundsWithinBounds", () => {
	it("() bounds", () => {
		const test = testWithinBounds({ gt: [0], lt: [10] })

		test.true({ gt: [0], lt: [10] })
		test.true({ gt: [1], lt: [9] })

		test.true({ gt: [0], lt: [9] })
		test.true({ gt: [1], lt: [10] })

		test.false({ gte: [0], lt: [10] })
		test.false({ gt: [0], lte: [10] })
		test.false({ gte: [0], lte: [10] })

		test.true({ gte: [1], lt: [9] })
		test.true({ gt: [1], lte: [9] })
		test.true({ gte: [1], lte: [9] })

		test.false({ gte: [0], lt: [9] })
		test.true({ gt: [0], lte: [9] })
		test.false({ gte: [0], lte: [9] })

		test.true({ gte: [1], lt: [10] })
		test.false({ gt: [1], lte: [10] })
		test.false({ gte: [1], lte: [10] })
	})

	it("[] bounds", () => {
		const test = testWithinBounds({ gte: [0], lte: [10] })

		test.true({ gt: [0], lt: [10] })
		test.true({ gte: [0], lt: [10] })
		test.true({ gt: [0], lte: [10] })
		test.true({ gte: [0], lte: [10] })

		test.true({ gt: [1], lt: [9] })
		test.true({ gte: [1], lt: [9] })
		test.true({ gt: [1], lte: [9] })
		test.true({ gte: [1], lte: [9] })

		test.true({ gt: [0], lt: [9] })
		test.true({ gte: [0], lt: [9] })
		test.true({ gt: [0], lte: [9] })
		test.true({ gte: [0], lte: [9] })

		test.true({ gt: [1], lt: [10] })
		test.true({ gte: [1], lt: [10] })
		test.true({ gt: [1], lte: [10] })
		test.true({ gte: [1], lte: [10] })

		test.false({ gt: [0], lt: [11] })
		test.false({ gt: [0], lte: [11] })

		test.false({ gt: [0], lt: [10, 0] })
		test.false({ gt: [0], lte: [10, 0] })

		test.false({ gt: [-1], lt: [10] })
		test.false({ gte: [-1], lt: [10] })

		test.true({ gt: [0, 0], lt: [10] })
		test.true({ gte: [0, 0], lt: [10] })
	})

	it("(] bounds", () => {
		const test = testWithinBounds({ gt: [0], lte: [10] })

		test.true({ gt: [0], lt: [10] })
		test.false({ gte: [0], lt: [10] })
		test.true({ gt: [0], lte: [10] })
		test.false({ gte: [0], lte: [10] })

		test.true({ gt: [1], lt: [9] })
		test.true({ gte: [1], lt: [9] })
		test.true({ gt: [1], lte: [9] })
		test.true({ gte: [1], lte: [9] })

		test.true({ gt: [0], lt: [9] })
		test.false({ gte: [0], lt: [9] })
		test.true({ gt: [0], lte: [9] })
		test.false({ gte: [0], lte: [9] })

		test.true({ gt: [1], lt: [10] })
		test.true({ gte: [1], lt: [10] })
		test.true({ gt: [1], lte: [10] })
		test.true({ gte: [1], lte: [10] })
	})

	it("[) bounds", () => {
		const test = testWithinBounds({ gte: [0], lt: [10] })

		test.true({ gt: [0], lt: [10] })
		test.true({ gte: [0], lt: [10] })
		test.false({ gt: [0], lte: [10] })
		test.false({ gte: [0], lte: [10] })

		test.true({ gt: [1], lt: [9] })
		test.true({ gte: [1], lt: [9] })
		test.true({ gt: [1], lte: [9] })
		test.true({ gte: [1], lte: [9] })

		test.true({ gt: [0], lt: [9] })
		test.true({ gte: [0], lt: [9] })
		test.true({ gt: [0], lte: [9] })
		test.true({ gte: [0], lte: [9] })

		test.true({ gt: [1], lt: [10] })
		test.true({ gte: [1], lt: [10] })
		test.false({ gt: [1], lte: [10] })
		test.false({ gte: [1], lte: [10] })
	})
})
