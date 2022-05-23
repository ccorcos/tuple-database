import { strict as assert } from "assert"
import sqlite from "better-sqlite3"
import * as fs from "fs-extra"
import level from "level"
import { after, describe, it } from "mocha"
import { ConcurrencyLog } from "../database/ConcurrencyLog"
import { ReactivityTracker } from "../database/sync/ReactivityTracker"
import { Assert, SchemaSubspace } from "../database/typeHelpers"
import { binarySearch } from "../helpers/binarySearch"
import { encodeTuple } from "../helpers/codec"
import { compare } from "../helpers/compare"
import { compareTuple } from "../helpers/compareTuple"
import { scan } from "../helpers/sortedTupleArray"
import {
	AsyncTupleDatabaseClient,
	transactionalAsyncQuery,
	transactionalQuery,
	TupleDatabase,
	TupleDatabaseClient,
	TupleDatabaseClientApi,
} from "../main"
import { InMemoryTupleStorage } from "../storage/InMemoryTupleStorage"
import { LevelTupleStorage } from "../storage/LevelTupleStorage"
import { SQLiteTupleStorage } from "../storage/SQLiteTupleStorage"
import { MAX, MIN, Writes } from "../storage/types"

describe("talk", () => {
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	describe("tuple sorting", () => {
		const items = [
			["jonathan", "smith"],
			["chet", "corcos"],
			["jon", "smith"],
		]

		it("compares tuples element-wise", () => {
			const sorted = [...items].sort(compareTuple)
			assert.deepEqual(sorted, [
				["chet", "corcos"],
				["jon", "smith"],
				["jonathan", "smith"],
			])
		})

		it("doesn't simply concat the elements", () => {
			const joined = [...items].map((tuple) => tuple.join(""))
			joined.sort(compare)

			assert.deepEqual(joined, [
				"chetcorcos",
				"jonathansmith", // changed order!
				"jonsmith",
			])
		})

		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//

		it("can be encoded into bytes while preserving order", () => {
			const encoded = items.map((tuple) => tuple.join("\x00"))
			encoded.sort(compare)
			assert.deepEqual(encoded, [
				"chet\x00corcos",
				"jon\x00smith",
				"jonathan\x00smith",
			])
		})

		// A take-home exercise.
		it.skip("escape \x00 bytes in elements while maintaining order")

		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//

		it("numbers can't just be stringified", () => {
			const encoded = [1, 2, 11, 12, 100].map((n) => n.toString())
			encoded.sort(compare)
			assert.deepEqual(encoded, ["1", "100", "11", "12", "2"])
		})

		it("can encode other kinds of values", () => {
			const encoded = [[1], ["hello", "world"], [true]].map(encodeTuple)
			encoded.sort(compare)

			// numbers < arrays < boolean
			assert.deepEqual(encoded, [
				"e>;;410230\x00",
				"fhello\x00fworld\x00",
				"gtrue\x00",
			])
		})
	})

	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//

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
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
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
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
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

	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//

	describe("TupleStorageApi", () => {
		it("InMemory Storage", () => {
			const storage = new InMemoryTupleStorage()

			storage.commit({
				set: [
					{ key: ["chet", "corcos"], value: 0 },
					{ key: ["jon", "smith"], value: 2 },
					{ key: ["jonathan", "smith"], value: 1 },
				],
			})

			const result = storage.scan({ gte: ["j"], lt: ["k"] })

			assert.deepEqual(result, [
				{ key: ["jon", "smith"], value: 2 },
				{ key: ["jonathan", "smith"], value: 1 },
			])
		})

		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//

		fs.mkdirpSync(__dirname + "/../tmp")

		it("LevelDb Storage", async () => {
			const filePath = __dirname + "/../tmp/level.db"
			const storage = new LevelTupleStorage(level(filePath))

			await storage.commit({
				set: [
					{ key: ["chet", "corcos"], value: 0 },
					{ key: ["jon", "smith"], value: 2 },
					{ key: ["jonathan", "smith"], value: 1 },
				],
			})

			const result = await storage.scan({ gte: ["j"], lt: ["k"] })

			assert.deepEqual(result, [
				{ key: ["jon", "smith"], value: 2 },
				{ key: ["jonathan", "smith"], value: 1 },
			])
		})
	})

	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//

	it("SQLite Storage", () => {
		const filePath = __dirname + "/../tmp/sqlite.db"
		const storage = new SQLiteTupleStorage(sqlite(filePath))

		storage.commit({
			set: [
				{ key: ["chet", "corcos"], value: 0 },
				{ key: ["jon", "smith"], value: 2 },
				{ key: ["jonathan", "smith"], value: 1 },
			],
		})

		const result = storage.scan({ gte: ["j"], lt: ["k"] })

		assert.deepEqual(result, [
			{ key: ["jon", "smith"], value: 2 },
			{ key: ["jonathan", "smith"], value: 1 },
		])
	})

	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//

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
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
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
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//

		it("transactional", () => {
			const db = new TupleDatabase(new InMemoryTupleStorage())

			db.commit({
				set: [
					{ key: ["score", "chet"], value: 2 },
					{ key: ["score", "meghan"], value: 1 },
				],
			})

			const chet = "tx1"
			const meghan = "tx2"

			// Meghan reads all the scores
			const items = db.scan({ gt: ["score"], lte: ["score", MAX] }, meghan)
			const total = items.map(({ value }) => value).reduce((a, b) => a + b, 0)

			// Chet writes a new score
			db.commit({ set: [{ key: ["score", "chet"], value: 5 }] }, chet)

			// Meghan writes the total
			assert.throws(() => {
				db.commit({ set: [{ key: ["total"], value: total }] }, meghan)
			})
		})

		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
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

	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//

	describe("Database client", () => {
		it("has schema types", () => {
			type Schema =
				| { key: ["score", string]; value: number }
				| { key: ["total"]; value: number }

			const db = new TupleDatabaseClient<Schema>(
				new TupleDatabase(new InMemoryTupleStorage())
			)

			db.commit({
				set: [
					{ key: ["score", "chet"], value: 1 },
					{ key: ["score", "meghan"], value: 2 },
					{ key: ["total"], value: 3 },
				],
			})

			// Convenient "prefix" argument.
			const scores = db.scan({ prefix: ["score"] })

			type WellTyped = Assert<
				typeof scores,
				{ key: ["score", string]; value: number }[]
			>
		})

		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//

		it("has subspaces", () => {
			type GameSchema =
				| { key: ["score", string]; value: number }
				| { key: ["total"]; value: number }

			function computeTotalScore(db: TupleDatabaseClientApi<GameSchema>) {
				return db
					.scan({ prefix: ["score"] })
					.map(({ value }) => value)
					.reduce((a, b) => a + b, 0)
			}

			type Schema =
				| { key: ["games", string]; value: null }
				| SchemaSubspace<["game", string], GameSchema>

			const db = new TupleDatabaseClient<Schema>(
				new TupleDatabase(new InMemoryTupleStorage())
			)

			// Narrow in on a specific game.
			const gameId: string = "game1"
			const gameDb = db.subspace(["game", gameId])
			const total = computeTotalScore(gameDb)
		})

		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//

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

		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//

		it("transaction conveniences", async () => {
			type Schema =
				| { key: ["score", string]; value: number }
				| { key: ["total"]; value: number }

			const db = new AsyncTupleDatabaseClient<Schema>(
				new TupleDatabase(new InMemoryTupleStorage())
			)

			example1: {
				const tx = db.transact()
				tx.set(["score", "chet"], 1)
				tx.set(["score", "meghan"], 2)
				tx.set(["total"], 3)
				await tx.commit()
			}

			example2: {
				const tx = db.transact()
				tx.set(["score", "chet"], 2)
				tx.set(["total"], 4)
				// Reading through a transaction will return an updates result.
				assert.equal(await tx.get(["total"]), 4)
				tx.cancel()
			}

			example3: {
				const updateTotal = transactionalAsyncQuery<Schema>()(async (tx) => {
					const result = await tx.scan({ prefix: ["score"] })
					const total = result
						.map(({ value }) => value)
						.reduce((a, b) => a + b, 0)
					tx.set(["total"], total)
				})

				const setScore = transactionalAsyncQuery<Schema>()(
					async (tx, person: string, score: number) => {
						tx.set(["score", person], score)
						await updateTotal(tx)
					}
				)

				await setScore(db, "joe", 15)

				assert.deepEqual(await db.scan(), [
					{ key: ["score", "chet"], value: 1 },
					{ key: ["score", "joe"], value: 15 },
					{ key: ["score", "meghan"], value: 2 },
					{ key: ["total"], value: 18 },
				])
			}
		})
	})

	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//
	//

	describe("Examples", () => {
		it("Social App", () => {
			// => socialApp.test.ts
		})

		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//
		//

		it("End-user Database", () => {
			type Value = string | number | boolean
			type Fact = [string, string, Value]

			type Obj = { id: string; [key: string]: Value | Value[] }

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

			// Represent objects that we're typically used to as triples.
			assert.deepEqual(
				objectToFacts({
					id: "1",
					name: "Chet",
					age: 31,
					tags: ["engineer", "musician"],
				}),
				[
					["1", "age", 31],
					["1", "name", "Chet"],
					["1", "tags", "engineer"],
					["1", "tags", "musician"],
				]
			)

			// A user-defined query.
			type Filter = { id: string; [prop: string]: Value }

			type Schema =
				// Index for fetching and displaying objects.
				| { key: ["eav", ...Fact]; value: null }
				// Index for looking up objects by property-value
				| { key: ["ave", string, Value, string]; value: null }
				// A list of user-defined filters.
				| { key: ["filter", string]; value: Filter }
				// And index for the given filter.
				| { key: ["index", string, string]; value: null }

			const writeFact = transactionalQuery<Schema>()((tx, fact: Fact) => {
				const [e, a, v] = fact
				tx.set(["eav", e, a, v], null)
				tx.set(["ave", a, v, e], null)

				// For each user-defined filter.
				const filters = tx
					.scan({ prefix: ["filter"] })
					.map(({ value }) => value)

				// Add this object id to the index if it passes the filter.
				filters.forEach((filter) => {
					if (!(a in filter)) {
						return
					}

					// If this fact breaks a filter, then remove it.
					if (filter[a] !== v) {
						tx.remove(["index", filter.id, e])
						return
					}

					// Make sure the whole filter passes.
					for (const [key, value] of Object.entries(filter)) {
						if (key === "id") continue
						if (key === a) continue // already checked this.
						if (!tx.exists(["eav", e, key, value])) return
					}

					// Add to the index for this filter.
					tx.set(["index", filter.id, e], null)
				})
			})

			const writeObject = transactionalQuery<Schema>()((tx, obj: Obj) => {
				for (const fact of objectToFacts(obj)) {
					writeFact(tx, fact)
				}
			})

			const createFilter = transactionalQuery<Schema>()(
				(tx, filter: Filter) => {
					tx.set(["filter", filter.id], filter)

					// Find objects that pass the filter.
					const pairs = Object.entries(filter).filter(([key]) => key !== "id")
					const [first, ...rest] = pairs

					const ids = tx
						// Find the objects that pass the first propery-value
						.scan({ prefix: ["ave", ...first] })
						.map(({ key }) => key[3])
						// Make sure that it passes the rest of the filter too.
						.filter((id) => {
							for (const [key, value] of rest) {
								if (!tx.exists(["eav", id, key, value])) return false
							}
							return true
						})

					// Write those ids to the index.
					ids.forEach((id) => {
						tx.set(["index", filter.id, id], null)
					})
				}
			)

			// Lets try it out.
			const db = new TupleDatabaseClient<Schema>(
				new TupleDatabase(new InMemoryTupleStorage())
			)

			writeObject(db, {
				id: "person1",
				name: "Chet",
				age: 31,
				tags: ["engineer", "musician"],
			})

			writeObject(db, {
				id: "person2",
				name: "Meghan",
				age: 30,
				tags: ["engineer", "botanist"],
			})

			writeObject(db, {
				id: "person3",
				name: "Saul",
				age: 31,
				tags: ["musician"],
			})

			createFilter(db, {
				id: "filter1",
				tags: "engineer",
			})

			const engineers = db
				.scan({ prefix: ["index", "filter1" as string] })
				.map(({ key }) => key[2])

			assert.deepEqual(engineers, ["person1", "person2"])

			createFilter(db, {
				id: "filter2",
				tags: "musician",
				age: 31,
			})

			writeObject(db, {
				id: "person4",
				name: "Sean",
				age: 31,
				tags: ["musician", "botanist"],
			})

			const musicians = db
				.scan({ prefix: ["index", "filter2" as string] })
				.map(({ key }) => key[2])

			assert.deepEqual(musicians, ["person1", "person3", "person4"])
		})
	})

	// Example 3: Game Counter.
})
