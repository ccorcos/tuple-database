import { ScanArgs, Index, Writes, Storage, Transaction, Tuple } from "./types"
import sqlite from "better-sqlite3"
import { InMemoryTransaction } from "./InMemoryStorage"

export class SQLiteStorage implements Storage {
	private db: sqlite.Database

	constructor(private dbPath: string) {
		this.db = sqlite(dbPath)
	}

	scan = (index: Index, args: ScanArgs = {}) => {
		// TODO: sanitize SQL index name.
		const select = `select * from ${index.name}`

		// TODO: serialize these args.
		const values: Array<any> = []

		const where = [
			...index.sort.map((dir, i) => {
				if (args.end) {
					const value = args.end[i]
					values.push(value)
					const cmp = dir === 1 ? `<=` : `>=`
					return `col${i} ${cmp} $${values.length - 1}`
				} else if (args.endBefore) {
					const value = args.endBefore[i]
					values.push(value)
					const cmp = dir === 1 ? `<` : `>`
					return `col${i} ${cmp} $${values.length - 1}`
				}
			}),
			...index.sort.map((dir, i) => {
				if (args.start) {
					const value = args.start[i]
					values.push(value)
					const cmp = dir === 1 ? `>=` : `<=`
					return `col${i} ${cmp} $${values.length - 1}`
				} else if (args.startAfter) {
					const value = args.startAfter[i]
					values.push(value)
					const cmp = dir === 1 ? `>` : `<`
					return `col${i} ${cmp} $${values.length - 1}`
				}
			}),
		]

		const limit = args.limit ? `limit ${args.limit}` : undefined

		const query = [select, ...where, limit].filter(Boolean).join("\n")

		const results = this.db.prepare(query).all(...values)

		return results
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
				.map((dir, i) => `col${i} numeric ${dir === 1 ? "asc" : "desc"}`)
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
						const obj = {}
						for (let i = 0; i < tuple.length; i++) {
							obj[`col${i}`] = tuple[i]
						}
						insertQuery.run(obj)
					}
					for (const tuple of deletes) {
						const obj = {}
						for (let i = 0; i < tuple.length; i++) {
							obj[`col${i}`] = tuple[i]
						}
						deleteQuery.run(obj)
					}
				}
			)

			runTransaction({ inserts: sets, deletes: removes })
		}
	}
}
