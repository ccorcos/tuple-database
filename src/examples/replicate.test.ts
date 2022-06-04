import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { compareTuple } from "../helpers/compareTuple"
import { SchemaSubspace } from "../main"
import { Fact, TriplestoreSchema, Value } from "./triplestore"

// We're going to build off of the triplestore example.
// So read triplestore.ts and triplestore.test.ts first.

type Obj = { id: string; [key: string]: Value | Value[] }

// Represent objects that we're typically used to as triples.
function objectToFacts(obj: Obj) {
	const facts: Fact[] = []
	const { id, ...rest } = obj
	for (const [key, value] of Object.entries(rest)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				facts.push([id, key, item])
			}
		} else {
			facts.push([id, key, value])
		}
	}
	facts.sort(compareTuple)
	return facts
}

objectToFacts({
	id: "1",
	name: "Chet",
	age: 31,
	tags: ["engineer", "musician"],
})

// const writeObjectFact = transactionalQuery<Schema>()((tx, fact: Fact) => {
// 	writeFact(tx.subspace(["data"]), fact)
// 	reindexFact(tx, fact)
// })

// const writeObject = transactionalQuery<Schema>()((tx, obj: Obj) => {
// 	for (const fact of objectToFacts(obj)) {
// 		writeObjectFact(tx, fact)
// 	}
// })

type Schema = SchemaSubspace<["data"], TriplestoreSchema> | { key: ["history"] }

describe("replicate", () => {
	it("works", () => {
		assert.ok(true)
	})
})
