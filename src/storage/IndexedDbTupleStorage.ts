import { IDBPDatabase, openDB } from "idb/with-async-ittr"
import { codec } from "../helpers/codec"
import { AsyncTupleStorageApi, ScanStorageArgs, WriteOps } from "../main"
import { KeyValuePair } from "./types"

const version = 1

const storeName = "tupledb"

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

		const lower = args?.gt || args?.gte
		const lowerEq = Boolean(args?.gte)

		const upper = args?.lt || args?.lte
		const upperEq = Boolean(args?.lte)

		let range: IDBKeyRange | null
		if (upper) {
			if (lower) {
				range = IDBKeyRange.bound(
					codec.encode(lower),
					codec.encode(upper),
					!lowerEq,
					!upperEq
				)
			} else {
				range = IDBKeyRange.upperBound(codec.encode(upper), !upperEq)
			}
		} else {
			if (lower) {
				range = IDBKeyRange.lowerBound(codec.encode(lower), !lowerEq)
			} else {
				range = null
			}
		}

		const direction: IDBCursorDirection = args?.reverse ? "prev" : "next"

		const limit = args?.limit || Infinity
		let results: KeyValuePair[] = []
		for await (const cursor of index.iterate(range, direction)) {
			results.push({
				key: codec.decode(cursor.key),
				value: cursor.value,
			})
			if (results.length >= limit) break
		}
		await tx.done

		return results
	}

	async commit(writes: WriteOps) {
		const db = await this.db
		const tx = db.transaction(storeName, "readwrite")
		for (const { key, value } of writes.set || []) {
			tx.store.put(value, codec.encode(key))
		}
		for (const key of writes.remove || []) {
			tx.store.delete(codec.encode(key))
		}
		await tx.done
	}

	async close() {
		const db = await this.db
		db.close()
	}
}
