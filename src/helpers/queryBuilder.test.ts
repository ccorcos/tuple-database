import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { TupleDatabase } from "../database/sync/TupleDatabase"
import { TupleDatabaseClient } from "../database/sync/TupleDatabaseClient"
import { InMemoryTupleStorage } from "../storage/InMemoryTupleStorage"
import { Value } from "../storage/types"
import { execute, QueryBuilder } from "./queryBuilder"

export type Order = number
export type Fact = [string, string, Order, Value]
export type Triple = [string, string, Value]

export type TriplestoreSchema =
	| { key: ["eaov", ...Fact]; value: null }
	| { key: ["aveo", string, Value, string, Order]; value: null }
	| { key: ["veao", Value, string, string, Order]; value: null }

const q = new QueryBuilder<TriplestoreSchema>()

const getNextOrder = (e: string, a: string) =>
	q
		.subspace(["eaov", e, a])
		.scan({ reverse: true, limit: 1 })
		.map((results) => {
			const lastOrder = results.map(({ key: [o, _v] }) => o)[0]
			const nextOrder = typeof lastOrder === "number" ? lastOrder + 1 : 0
			return nextOrder
		})

const writeFact = (fact: Fact) => {
	const [e, a, o, v] = fact
	return q.write({
		set: [
			{ key: ["eaov", e, a, o, v], value: null },
			{ key: ["aveo", a, v, e, o], value: null },
			{ key: ["veao", v, e, a, o], value: null },
		],
	})
}

const appendTriple = ([e, a, v]: Triple) =>
	getNextOrder(e, a).chain((nextOrder) => {
		return writeFact([e, a, nextOrder, v])
	})

describe("queryBuilder", () => {
	it("works", () => {
		assert.ok(true)

		const db = new TupleDatabaseClient<TriplestoreSchema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		execute(db, appendTriple(["chet", "color", "red"]))
		execute(db, appendTriple(["chet", "color", "blue"]))

		console.log("RESULT", db.scan())
	})
})
