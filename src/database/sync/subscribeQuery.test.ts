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

	it("doesn't run second callback if it is destroyed in first", async () => {
		type Schema =
			| {
					key: ["filesById", number]
					value: string
			  }
			| {
					key: ["focusedFileId"]
					value: number
			  }

		const db = new TupleDatabaseClient(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		const initTx = db.transact()
		initTx.set(["filesById", 1], "file 1 value")
		initTx.set(["focusedFileId"], 1)
		initTx.commit()

		let focusedFile: number | undefined = undefined
		let focusedFileValue: string | undefined = undefined
		let subscription:
			| { result: string | undefined; destroy: () => void }
			| undefined = undefined

		function subscribeToFocusedFile(focusedFile: number) {
			subscription = subscribeQuery(
				db,
				(db) => db.get(["filesById", focusedFile]),
				(value) => {
					focusedFileValue = value
				}
			)

			focusedFileValue = subscription.result
		}

		const focusedFileQuery = subscribeQuery(
			db,
			(db) => db.get(["focusedFileId"])!,
			(result) => {
				focusedFile = result
				subscription?.destroy()
				subscribeToFocusedFile(focusedFile!)
			}
		)

		focusedFile = focusedFileQuery.result
		subscribeToFocusedFile(focusedFile!)

		assertEqual(focusedFile, 1)
		assertEqual(focusedFileValue, "file 1 value")

		const tx = db.transact()
		tx.remove(["filesById", 1])
		tx.set(["filesById", 2], "file 2 value")
		tx.set(["focusedFileId"], 2)
		tx.commit()

		assertEqual(focusedFile, 2)
		assertEqual(focusedFileValue, "file 2 value")
	})
})
