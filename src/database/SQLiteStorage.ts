import { ScanArgs, Index, Writes, Storage, Tuple } from "./types"
import sqlite from "better-sqlite3"
import { InMemoryTransaction } from "./InMemoryStorage"
import { decodeQueryValue, encodeQueryValue } from "./codec"
import { compare } from "../helpers/compare"
import { collapseTextChangeRangesAcrossMultipleVersions } from "typescript"
import { QueryValue } from "./compareTuple"

export class SQLiteStorage implements Storage {
	private db: sqlite.Database

	constructor(private dbPath: string) {
		this.db = sqlite(dbPath)
	}

	scan = (index: Index, args: ScanArgs = {}) => {
		// TODO: sanitize SQL index name.
		const select = `select * from ${index.name}`

		// Construct the arguments.
		const sqlArgs = {}
		if (args.end) {
			for (let i = 0; i < args.end.length; i++) {
				sqlArgs[`end${i}`] = encodeQueryValue(args.end[i])
			}
		}
		if (args.endBefore) {
			for (let i = 0; i < args.endBefore.length; i++) {
				sqlArgs[`endBefore${i}`] = encodeQueryValue(args.endBefore[i])
			}
		}
		if (args.start) {
			for (let i = 0; i < args.start.length; i++) {
				sqlArgs[`start${i}`] = encodeQueryValue(args.start[i])
			}
		}
		if (args.startAfter) {
			for (let i = 0; i < args.startAfter.length; i++) {
				sqlArgs[`startAfter${i}`] = encodeQueryValue(args.startAfter[i])
			}
		}

		const where = [
			...(args.end || []).map((value, i) => {
				const dir = index.sort[i]
				const cmp = dir === 1 ? `<=` : `>=`
				return `col${i} ${cmp} $end${i}`
			}),
			...(args.endBefore || []).map((value, i, arr) => {
				const dir = index.sort[i]
				// Only do the not-equal comparison on the last column so we can match the
				// prefix and treat the set of columns as a sorted tuple.
				const cmp =
					i === arr.length - 1
						? dir === 1
							? `<`
							: `>`
						: dir === 1
						? `<=`
						: `>=`
				return `col${i} ${cmp} $endBefore${i}`
			}),
			...(args.start || []).map((value, i) => {
				const dir = index.sort[i]
				const cmp = dir === 1 ? `>=` : `<=`
				return `col${i} ${cmp} $start${i}`
			}),
			...(args.startAfter || []).map((value, i, arr) => {
				const dir = index.sort[i]
				// Only do the not-equal comparison on the last column so we can match the
				// prefix and treat the set of columns as a sorted tuple.
				const cmp =
					i === arr.length - 1
						? dir === 1
							? `>`
							: `<`
						: dir === 1
						? `>=`
						: `<=`
				return `col${i} ${cmp} $startAfter${i}`
			}),
		]
			.filter(Boolean)
			.join(" and ")

		let query = select
		if (where) {
			query += `\nwhere\n${where}`
		}
		if (args.limit) {
			query += `\nlimit ${args.limit}`
		}

		try {
			console.log("QUERY", query, sqlArgs)
			const results = this.db.prepare(query).all(sqlArgs)
			return results.map(decodeObj)
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
		for (const [name, { sets, removes, sort }] of Object.entries(writes)) {
			const tableCols = sort
				.map((dir, i) => `col${i} text ${dir === 1 ? "asc" : "desc"}`)
				.join(",\n\t")
			const createTable = `
				create table if not exists ${name} (
					${tableCols}
				)
			`
			this.db.prepare(createTable).run()
		}

		for (const [name, { sets, removes, sort }] of Object.entries(writes)) {
			const insertQuery = this.db.prepare(
				`insert into ${name} values (${sort
					.map((_dir, i) => `$col${i}`)
					.join(",")})`
			)

			const deleteQuery = this.db.prepare(
				`delete from ${name} where ${sort
					.map((_dir, i) => `col${i} = $col${i}`)
					.join(" and ")}`
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
						const obj = encodeTuple(tuple)
						insertQuery.run(obj)
					}
					for (const tuple of deletes) {
						const obj = encodeTuple(tuple)
						deleteQuery.run(obj)
					}
				}
			)

			runTransaction({ inserts: sets, deletes: removes })
		}
	}
}

function encodeTuple(tuple: Tuple) {
	const obj = {}
	for (let i = 0; i < tuple.length; i++) {
		obj[`col${i}`] = encodeQueryValue(tuple[i])
	}
	return obj
}

function decodeObj(obj: { [key: string]: string }) {
	const tuple = Object.entries(obj)
		.sort(([k1], [k2]) => compare(k1, k2))
		.map(([k, value]) => decodeQueryValue(value))

	return tuple as Tuple // TODO: wtf min/max?
}

function getScanPrefix(scanArgs: ScanArgs) {
	// Compute the common prefix.
	const prefix: Array<QueryValue> = []
	const start = scanArgs.start || scanArgs.startAfter || []
	const end = scanArgs.end || scanArgs.endBefore || []
	const len = Math.min(start.length, end.length)
	for (let i = 0; i < len; i++) {
		if (start[i] === end[i]) {
			prefix.push(start[i])
		} else {
			break
		}
	}
	return prefix
}
