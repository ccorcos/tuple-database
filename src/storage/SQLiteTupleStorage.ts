import { Database, Transaction } from "better-sqlite3"
import { decodeTuple, encodeTuple } from "../helpers/codec"
import {
	ScanStorageArgs,
	Tuple,
	TupleStorage,
	TupleValuePair,
	Writes,
} from "./types"

export class SQLiteTupleStorage implements TupleStorage {
	/**
	 * import sqlite from "better-sqlite3"
	 * new SQLiteTupleStorage(sqlite("path/to.db"))
	 */
	constructor(private db: Database) {
		const createTableQuery = db.prepare(
			`create table if not exists data ( key text primary key, value text)`
		)

		// Make sure the table exists.
		createTableQuery.run()

		const insertQuery = db.prepare(
			`insert or replace into data values ($key, $value)`
		)
		const deleteQuery = db.prepare(`delete from data where key = $key`)

		this.writeFactsQuery = this.db.transaction(
			({
				inserts,
				deletes,
			}: {
				inserts: TupleValuePair[] | undefined
				deletes: Tuple[] | undefined
			}) => {
				for (const [tuple, value] of inserts || []) {
					insertQuery.run({
						key: encodeTuple(tuple),
						value: JSON.stringify(value),
					})
				}
				for (const tuple of deletes || []) {
					deleteQuery.run({ key: encodeTuple(tuple) })
				}
			}
		)
	}

	private writeFactsQuery: Transaction

	scan = (args: ScanStorageArgs = {}, txId?: string) => {
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

	commit = (writes: Writes, txId?: string) => {
		const { set: inserts, remove: deletes } = writes
		this.writeFactsQuery({ inserts, deletes })
	}

	close() {
		this.db.close()
	}
}
