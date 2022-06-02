import { IDBPDatabase, openDB } from "idb"
import { result } from "lodash"
import { decodeTuple, encodeTuple } from "../helpers/codec"
import { AsyncTupleStorageApi, ScanStorageArgs, Writes } from "../main"
import { KeyValuePair } from "./types"

const version = 1

const storeName = "tupledb"
const keyIndex = "keyIndex"

export class IndexedDbTupleStorage implements AsyncTupleStorageApi {
	private db: Promise<IDBPDatabase<any>>

	constructor(public dbName: string) {
		this.db = openDB(dbName, version, {
			upgrade(db) {
				const store = db.createObjectStore(storeName)
				store.createIndex(keyIndex, "key")
			},
		})
	}

	async scan(args?: ScanStorageArgs) {
		const db = await this.db
		const tx = db.transaction(storeName, "readonly")
		const index = tx.store.index(keyIndex)

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
					lowerEq,
					upperEq
				)
			} else {
				range = IDBKeyRange.upperBound(encodeTuple(upper), upperEq)
			}
		} else {
			if (lower) {
				range = IDBKeyRange.lowerBound(encodeTuple(lower), lowerEq)
			} else {
				range = null
			}
		}

		const direction: IDBCursorDirection = args?.reverse ? "prev" : "next"

		const limit = args?.limit || Infinity
		let results: KeyValuePair[] = []
		for await (const cursor of index.iterate(range, direction)) {
			results.push({
				key: decodeTuple(cursor.key),
				value: cursor.value,
			})
			if (result.length >= limit) break
		}
		await tx.done

		return results
	}

	async commit(writes: Writes) {
		const db = await this.db
		const tx = db.transaction(storeName, "readwrite")
		for (const { key, value } of writes.set || []) {
			tx.store.put(encodeTuple(key), value)
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
