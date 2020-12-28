import { ScanArgs, Writes, Storage, Tuple, Value } from "../types"
import sqlite from "better-sqlite3"
import { InMemoryTransaction } from "./InMemoryStorage"
import { decodeTuple, encodeTuple } from "../helpers/codec"
import { getBounds } from "../helpers/sortedTupleArray"

export class SQLiteStorage implements Storage {
	private db: sqlite.Database

	constructor(private dbPath: string) {
		this.db = sqlite(dbPath)
	}

	scan = (index: string, args: ScanArgs = {}) => {
		const bounds = getBounds(args)

		// Bounds.
		let start = bounds.gte ? encodeTuple(bounds.gte) : undefined
		let startAfter: string | undefined = bounds.gt
			? encodeTuple(bounds.gt)
			: undefined
		let end: string | undefined = bounds.lte
			? encodeTuple(bounds.lte)
			: undefined
		let endBefore: string | undefined = bounds.lt
			? encodeTuple(bounds.lt)
			: undefined

		const sqlArgs = {
			start,
			startAfter,
			end,
			endBefore,
			limit: args.limit,
		}

		const where = [
			start ? "value >= $start" : undefined,
			startAfter ? "value > $startAfter" : undefined,
			end ? "value <= $end" : undefined,
			endBefore ? "value < $endBefore" : undefined,
		]
			.filter(Boolean)
			.join(" and ")

		let sqlQuery = `select * from ${sanitizeIndexName(index)}`
		if (where) {
			sqlQuery += " where "
			sqlQuery += where
		}
		if (args.limit) {
			sqlQuery += ` limit $limit`
		}

		try {
			const results = this.db.prepare(sqlQuery).all(sqlArgs)
			return results.map(({ value }) => decodeTuple(value) as Tuple)
		} catch (e) {
			if (e.message.includes("no such table:")) {
				return []
			} else {
				throw e
			}
		}
	}

	transact() {
		return new InMemoryTransaction({
			scan: this.scan,
			commit: this.commit,
		})
	}

	commit = (writes: Writes) => {
		// Make sure the tables exist.
		for (const [index] of Object.entries(writes)) {
			const createTableQuery = `create table if not exists ${sanitizeIndexName(
				index
			)} ( value text )`
			this.db.prepare(createTableQuery).run()
		}

		for (const [index, { sets, removes }] of Object.entries(writes)) {
			const insertQuery = this.db.prepare(
				`insert into ${sanitizeIndexName(index)} values ($value)`
			)

			const deleteQuery = this.db.prepare(
				`delete from ${sanitizeIndexName(index)} where value = $value`
			)

			const runTransaction = this.db.transaction(
				({
					inserts,
					deletes,
				}: {
					inserts: Array<Tuple>
					deletes: Array<Tuple>
				}) => {
					for (const tuple of inserts) {
						insertQuery.run({ value: encodeTuple(tuple) })
					}
					for (const tuple of deletes) {
						deleteQuery.run({ value: encodeTuple(tuple) })
					}
				}
			)

			runTransaction({ inserts: sets, deletes: removes })
		}
	}
}

function sanitizeIndexName(index: string) {
	return "index_" + index.toLowerCase().replace(/[^a-z]/g, "")
}
