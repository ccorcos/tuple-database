import * as _ from "lodash"
import { describe, it } from "mocha"
import assert from "assert"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { IndexerMiddleware } from "./IndexerMiddleware"

function createStorage() {
	return new IndexerMiddleware(new InMemoryStorage(), (tx, op) => {
		if (op.index === "eav") {
			const [e, a, v] = op.tuple
			tx[op.type]("ave", [a, v, e])
			tx[op.type]("vea", [v, e, a])
			tx[op.type]("vae", [v, a, e])
		}
	})
}

describe("IndexerStorage", () => {
	it("works", () => {
		const store = createStorage()

		const tx = store.transact()

		tx.set("eav", ["0001", "type", "Person"])
			.set("eav", ["0001", "firstName", "Chet"])
			.set("eav", ["0001", "lastName", "Corcos"])
			.set("eav", ["0002", "type", "Person"])
			.set("eav", ["0002", "firstName", "Meghan"])
			.set("eav", ["0002", "lastName", "Navarro"])

		// Test that the indexer is running on every write within a transaction.
		assert.deepStrictEqual(tx.scan("ave", { prefix: ["type", "Person"] }), [
			["type", "Person", "0001"],
			["type", "Person", "0002"],
		])

		tx.commit()

		// Test that the result is written to storage.
		assert.deepStrictEqual(store.scan("ave", { prefix: ["type", "Person"] }), [
			["type", "Person", "0001"],
			["type", "Person", "0002"],
		])
	})
})
