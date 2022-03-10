import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { normalizeTupleBounds } from "../helpers/sortedTupleArray"
import { ConcurrencyLog } from "./ConcurrencyLog"
import { Tuple } from "./types"

function bounds(prefix: Tuple) {
	return normalizeTupleBounds({ prefix })
}

describe("ConcurrencyLog", () => {
	it("Only records writes with conflicting reads.", () => {
		const log = new ConcurrencyLog()

		log.write("tx1", [1])
		assert.deepEqual(log.log, [])

		log.read("tx2", bounds([2]))

		log.write("tx3", [2])
		log.write("tx3", [3])

		assert.deepEqual(log.log, [
			{ type: "read", txId: "tx2", bounds: bounds([2]) },
			{ type: "write", txId: "tx3", tuple: [2] },
		])

		assert.throws(() => log.commit("tx2"))
		assert.deepEqual(log.log, [])
	})

	it.skip("Keeps writes that conflict with reads of other transactions.")
})
