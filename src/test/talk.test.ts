import { strict as assert } from "assert"
import { after, describe, it } from "mocha"
import { ConcurrencyLog } from "../database/ConcurrencyLog"
import { ReactivityTracker } from "../database/sync/ReactivityTracker"
import { binarySearch } from "../helpers/binarySearch"
import { compare } from "../helpers/compare"
import { compareTuple } from "../helpers/compareTuple"
import { scan } from "../helpers/sortedTupleArray"
import { AsyncTupleDatabaseClient, TupleDatabase } from "../main"
import { InMemoryTupleStorage } from "../storage/InMemoryTupleStorage"
import { MAX, MIN, Writes } from "../storage/types"

describe("talk", () => {
	describe("binary search", () => {
		const items = [0, 1, 2, 3, 4, 5]

		it("find middle", () => {
			const result = binarySearch(items, 1.5, compare)
			assert.deepEqual(result, { closest: 2 })

			// insert
			const newItems = [...items]
			newItems.splice(result.closest, 0, 1.5)
			assert.deepEqual(newItems, [0, 1, 1.5, 2, 3, 4, 5])
		})

		it("find exact", () => {
			const result = binarySearch(items, 5, compare)
			assert.deepEqual(result, { found: 5 })

			// delete
			const newItems = [...items]
			newItems.splice(result.found, 1)
			assert.deepEqual(newItems, [0, 1, 2, 3, 4])
		})
	})

	//
	//

	describe("scan", () => {
		const items = [
			["chet", "corcos"],
			["charlotte", "whitney"],
			// ["j"]
			// ["jon", MIN]
			["jon", "smith"],
			["jon", "stevens"],
			// ["jon", MAX]
			["jonathan", "smith"],
			// ["k"]
			["zoe", "brown"],
		].sort(compareTuple)

		it("works", () => {
			const result = scan(items, { gte: ["j"], lt: ["k"] })
			assert.deepEqual(result, [
				["jon", "smith"],
				["jon", "stevens"],
				["jonathan", "smith"],
			])
		})

		it("scan prefix", () => {
			const result = scan(items, { gt: ["jon", MIN], lt: ["jon", MAX] })
			assert.deepEqual(result, [
				["jon", "smith"],
				["jon", "stevens"],
			])
		})
	})

	//
	//

	describe("tuple-value pairs", () => {
		const pairs: { key: string[]; value?: number }[] = [
			{ key: ["chet", "corcos"], value: 0 },
			{ key: ["jon", "smith"], value: 2 },
			{ key: ["jonathan", "smith"], value: 1 },
		]

		it("works", () => {
			const result = binarySearch(pairs, { key: ["jon", "smith"] }, (a, b) => {
				return compareTuple(a.key, b.key)
			})
			assert.deepEqual(result, { found: 1 })
		})
	})

	describe("TupleDatabase", () => {
		it("reactivity", () => {
			const db = new TupleDatabase(new InMemoryTupleStorage())

			let writes: Writes | undefined
			const unsubscribe = db.subscribe(
				{ gt: ["score"], lt: ["score", MAX] },
				(w) => {
					writes = w
				}
			)
			after(unsubscribe)

			db.commit({ set: [{ key: ["score", "chet"], value: 2 }] })
			assert.deepEqual(writes, {
				set: [{ key: ["score", "chet"], value: 2 }],
				remove: [],
			})
		})

		//
		//
		//

		it("ReactivityTracker", () => {
			const reactivity = new ReactivityTracker()

			const unsubscribe = reactivity.subscribe(
				{ gt: ["score"], lte: ["score", MAX] },
				(writes) => {}
			)

			// Listen on a tuple prefix, include bounds for checking after.
			//
			// console.log(reactivity.listenersDb.scan())
			// [
			// 	{
			// 		key: [["score"], "bb1beaa2-dd87-440e-b74f-95f307129e2b"],
			// 		value: {
			// 			callback: (writes) => {},
			// 			bounds: { gt: ["score"], lte: ["score", MAX] },
			// 		},
			// 	},
			// ]

			const emits = reactivity.computeReactivityEmits({
				set: [{ key: ["score", "chet"], value: 10 }],
			})
			// Look for listeners at any prefix: ["score", "chet"], ["score"], and []
			//
			// console.log(emits)
			// Map {
			// 	 [(writes) => {}] => { set: [ { key: ["score", "chet"], value: 10 } ] }
			// }
		})

		//
		//

		//
		//

		it("ConcurrencyLog.", () => {
			const log = new ConcurrencyLog()

			// Someone reads all the scores and updates the total
			log.read("tx1", { gt: ["score"], lte: ["score", MAX] })

			// At the same time, someone writes a score.
			log.write("tx2", ["score", "chet"])

			// Keeping track of concurrent reads/writes.
			assert.deepEqual(log.log, [
				{
					txId: "tx1",
					type: "read",
					bounds: {
						gt: ["score"],
						lte: ["score", MAX],
					},
				},
				{
					txId: "tx2",
					type: "write",
					tuple: ["score", "chet"],
				},
			])

			// Check for conflicts.
			log.commit("tx2")
			assert.throws(() => log.commit("tx1"))
		})
	})

	describe("Database client", () => {
		// Useful for multiple windows, for example.
		it("works across processes", async () => {
			const db = new TupleDatabase(new InMemoryTupleStorage())

			const db2 = new AsyncTupleDatabaseClient({
				scan: async (...args) => db.scan(...args),
				commit: async (...args) => db.commit(...args),
				cancel: async (...args) => db.cancel(...args),
				close: async (...args) => db.close(...args),
				// Note: this requires a socket, not just RPC.
				subscribe: async (args, callback) => db.subscribe(args, callback),
			})

			db.commit({ set: [{ key: ["a"], value: 1 }] })
			assert.equal(await db2.get(["a"]), 1)
		})
	})

	//
	//

	describe("Examples", () => {
		it("Social App", () => {
			// => socialApp.test.ts
		})

		it("End-user Database", () => {})
	})

	// Example 3: Game Counter.
})
