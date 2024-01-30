import { IDBPDatabase, openDB } from "idb/with-async-ittr"
import { decodeTuple, encodeTuple } from "../helpers/codec"
import { AsyncTupleStorageApi, ScanStorageArgs, WriteOps } from "../main"
import { KeyValuePair } from "./types"

const version = 1

const storeName = "tupledb"

function buildRange(args?: ScanStorageArgs): IDBKeyRange | null {
	const lower = args?.gt || args?.gte
	const lowerEq = Boolean(args?.gte)

	const upper = args?.lt || args?.lte
	const upperEq = Boolean(args?.lte)

	let range: IDBKeyRange | null
	if (upper) {
		if (lower) {
			range = IDBKeyRange.bound(
				encodeTuple(lower),
				encodeTuple(upper),
				!lowerEq,
				!upperEq
			)
		} else {
			range = IDBKeyRange.upperBound(encodeTuple(upper), !upperEq)
		}
	} else {
		if (lower) {
			range = IDBKeyRange.lowerBound(encodeTuple(lower), !lowerEq)
		} else {
			range = null
		}
	}

	return range
}

export class IndexedDbTupleStorage implements AsyncTupleStorageApi {
	private db: Promise<IDBPDatabase<any>>

	constructor(public dbName: string) {
		this.db = openDB(dbName, version, {
			upgrade(db) {
				db.createObjectStore(storeName)
			},
		})
	}

	async scan(args?: ScanStorageArgs) {
		const db = await this.db
		const tx = db.transaction(storeName, "readonly")
		const index = tx.store // primary key

		const range = buildRange(args)
		const direction: IDBCursorDirection = args?.reverse ? "prev" : "next"

		const limit = args?.limit || Infinity
		let results: KeyValuePair[] = []
		for await (const cursor of index.iterate(range, direction)) {
			results.push({
				key: decodeTuple(cursor.key),
				value: cursor.value,
			})
			if (results.length >= limit) break
		}
		await tx.done

		return results
	}

	async *iterate(args?: ScanStorageArgs): AsyncGenerator<KeyValuePair> {
		const db = await this.db
		const tx = db.transaction(storeName, "readonly")
		const index = tx.store // primary key

		const range = buildRange(args)
		const direction: IDBCursorDirection = args?.reverse ? "prev" : "next"

		const limit = args?.limit || Infinity
		let results: KeyValuePair[] = []
		for await (const cursor of index.iterate(range, direction)) {
			yield {
				key: decodeTuple(cursor.key),
				value: cursor.value,
			}
			if (results.length >= limit) break
		}
		await tx.done
	}

	async commit(writes: WriteOps) {
		const db = await this.db
		const tx = db.transaction(storeName, "readwrite")
		for (const { key, value } of writes.set || []) {
			tx.store.put(value, encodeTuple(key))
		}
		for (const key of writes.remove || []) {
			tx.store.delete(encodeTuple(key))
		}
		await tx.done
	}

	async close() {
		const db = await this.db
		db.close()
	}
}
