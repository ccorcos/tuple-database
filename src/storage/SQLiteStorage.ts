import { Database, Statement, Transaction } from "better-sqlite3"
import { decodeTuple, encodeTuple } from "../helpers/codec"
import { normalizeTupleBounds } from "../helpers/sortedTupleArray"
import { InMemoryTransaction } from "./InMemoryStorage"
import {
	Indexer,
	ScanArgs,
	Tuple,
	TupleStorage,
	TupleValuePair,
	Writes,
} from "./types"

export class SQLiteStorage implements TupleStorage {
	/**
	 * import sqlite from "better-sqlite3"
	 * new SQLiteStorage(sqlite("path/to.db"))
	 */
	constructor(private db: Database) {
		const createTableQuery = db.prepare(
			`create table if not exists data ( key text primary key, value text)`
		)

		// Make sure the table exists.
		createTableQuery.run()

		// Compile queries ahead of time for performance.
		this.getQuery = db.prepare(`select value from data where key = $key`)
		this.existsQuery = db.prepare(`select 1 from data where key = $key`)

		const insertQuery = db.prepare(
			`insert or replace into data values ($key, $value)`
		)
		const deleteQuery = db.prepare(`delete from data where key = $key`)

		this.writeFacts = this.db.transaction(
			({
				inserts,
				deletes,
			}: {
				inserts: TupleValuePair[]
				deletes: Tuple[]
			}) => {
				for (const [tuple, value] of inserts) {
					insertQuery.run({
						key: encodeTuple(tuple),
						value: JSON.stringify(value),
					})
				}
				for (const tuple of deletes) {
					deleteQuery.run({ key: encodeTuple(tuple) })
				}
			}
		)
	}

	indexers: Indexer[] = []

	index(indexer: Indexer) {
		this.indexers.push(indexer)
		return this
	}

	private getQuery: Statement
	private existsQuery: Statement
	private writeFacts: Transaction

	get(tuple: Tuple) {
		const result = this.getQuery.get({ key: encodeTuple(tuple) })
		if (result === undefined) return
		return JSON.parse(result.value)
	}

	exists(tuple: Tuple) {
		const result = this.existsQuery.get({ key: encodeTuple(tuple) })
		if (result === undefined) return false
		return Boolean(result[1])
	}

	scan = (args: ScanArgs = {}) => {
		const bounds = normalizeTupleBounds(args)

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
			start ? "key >= $start" : undefined,
			startAfter ? "key > $startAfter" : undefined,
			end ? "key <= $end" : undefined,
			endBefore ? "key < $endBefore" : undefined,
		]
			.filter(Boolean)
			.join(" and ")

		let sqlQuery = `select * from data`
		if (where) {
			sqlQuery += " where "
			sqlQuery += where
		}
		if (args.limit) {
			sqlQuery += ` limit $limit`
		}
		sqlQuery += " order by key"

		const results = this.db.prepare(sqlQuery).all(sqlArgs)

		return results.map(
			({ key, value }) =>
				[decodeTuple(key) as Tuple, JSON.parse(value)] as TupleValuePair
		)
	}

	transact() {
		return new InMemoryTransaction(this)
	}

	commit = (writes: Writes) => {
		const { set: inserts, remove: deletes } = writes
		this.writeFacts({ inserts, deletes })
	}

	close() {
		this.db.close()
	}
}
