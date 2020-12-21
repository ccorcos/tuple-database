import { ScanArgs, Writes, Storage, Tuple, Value } from "./types"
import sqlite from "better-sqlite3"
import { InMemoryTransaction } from "./InMemoryStorage"
import { decodeTuple, encodeTuple } from "./codec"

export class SQLiteStorage implements Storage {
	private db: sqlite.Database

	constructor(private dbPath: string) {
		this.db = sqlite(dbPath)
	}

	scan = (index: string, args: ScanArgs = {}) => {
		// Bounds.
		let start = args.gte ? encodeTuple(args.gte) : undefined
		let startAfter: string | undefined = args.gt
			? encodeTuple(args.gt)
			: undefined
		let end: string | undefined = args.lte ? encodeTuple(args.lte) : undefined
		let endBefore: string | undefined = args.lt
			? encodeTuple(args.lt)
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

		// TODO: sanitize SQL index name.
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

	protected commit = (writes: Writes) => {
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
