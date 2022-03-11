import { describe, it } from "mocha"
import { transactional } from "../helpers/transactional"
import { InMemoryTupleStorage } from "../storage/InMemoryTupleStorage"
import { TupleDatabase } from "../storage/sync/TupleDatabase"

describe("Triplestore", () => {
	it("works", () => {
		const db = new TupleDatabase(new InMemoryTupleStorage())

		type Fact = [string, string, string]

		// type Fact = [string, string, number, string]

		const writeFact = transactional((tx, fact: Fact) => {
			const [e, a, v] = fact
			tx.set(["eav", e, a, v], null)
			tx.set(["ave", a, v, e], null)
			tx.set(["vea", v, e, a], null)
		})

		const removeFact = transactional((tx, fact: Fact) => {
			const [e, a, v] = fact
			tx.remove(["eav", e, a, v])
			tx.remove(["ave", a, v, e])
			tx.remove(["vea", v, e, a])
		})

		const facts: Fact[] = [
			["1", "name", "chet"],
			// ["4", "name", "chet"],
			["2", "name", "tk"],
			// ["2", "name", "tanishq"],
			["3", "name", "joe"],
			["2", "worksFor", "1"],
			["3", "worksFor", "1"],
		]

		for (const fact of facts) {
			writeFact(db, fact)
		}

		// who works for chet?
		// [?id, name, chet]
		// [?who, worksFor, ?id]
		// [?who, name, ?name]
		const chetIds = db
			.scan({ prefix: ["ave", "name", "chet"] })
			.map((pair) => pair[0])
			.map((tuple) => tuple[tuple.length - 1] as string)

		if (chetIds.length !== 1) throw new Error()

		const chetId = chetIds[0]

		const who = db
			.scan({ prefix: ["ave", "worksFor", chetId] })
			.map((pair) => pair[0])
			.map((tuple) => tuple[tuple.length - 1] as string)
			.map((id) => {
				console.log("id", id)
				const names = db
					.scan({ prefix: ["eav", id, "name"] })
					.map((pair) => pair[0])
					.map((tuple) => tuple[tuple.length - 1] as string)
				if (names.length !== 1) throw new Error()
				return names[0] as string
			})

		console.log("who", who)
	})
})
