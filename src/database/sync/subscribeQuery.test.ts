import { describe, it } from "mocha"
import { InMemoryTupleStorage } from "../../main"
import { assertEqual } from "../../test/assertHelpers"
import { subscribeQuery } from "./subscribeQuery"
import { TupleDatabase } from "./TupleDatabase"
import { TupleDatabaseClient } from "./TupleDatabaseClient"

describe("subscribeQuery", () => {
	it("works", async () => {
		const db = new TupleDatabaseClient(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		function setA(a: number) {
			const tx = db.transact()
			tx.set(["a"], a)
			tx.commit()
		}

		setA(0)

		let aResult: number | undefined = undefined

		const { result, destroy } = subscribeQuery(
			db,
			(db) => db.get(["a"]),
			(result) => {
				aResult = result
			}
		)

		assertEqual(aResult, undefined)
		assertEqual(result, 0)

		setA(1)

		assertEqual(aResult, 1)

		destroy()
	})
})
