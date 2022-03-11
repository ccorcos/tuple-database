/*

This file is generated from AsyncTupleDatabase.ts

*/
import { iterateWrittenTuples } from "../helpers/iterateTuples"
import { randomId } from "../helpers/randomId"
import * as t from "../helpers/sortedTupleArray"
import { Bounds, normalizeTupleBounds } from "../helpers/sortedTupleArray"
import * as tv from "../helpers/sortedTupleValuePairs"
import { ConcurrencyLog } from "./ConcurrencyLog"
import {
	Operation,
	ScanArgs,
	Tuple,
	TupleStorage,
	TupleValuePair,
	TxId,
	Writes,
} from "./types"

export type Indexer = (tx: TupleTransaction, op: Operation) => void

export interface ReadOnlyTupleDatabase {
	get(tuple: Tuple, txId?: TxId): any
	exists(tuple: Tuple, txId?: TxId): boolean
	scan(args?: ScanArgs, txId?: TxId): TupleValuePair[]
}

export class TupleDatabase {
	constructor(private storage: TupleStorage) {}

	log = new ConcurrencyLog()

	get(tuple: Tuple, txId?: TxId): any {
		const bounds: Bounds = { gte: tuple, lte: tuple }
		if (txId) this.log.read(txId, bounds)

		const items = this.storage.scan(bounds)
		if (items.length === 0) return
		if (items.length > 1) throw new Error("Get expects only one value.")
		const pair = items[0]
		return pair[1]
	}

	exists(tuple: Tuple, txId?: TxId): boolean {
		const bounds: Bounds = { gte: tuple, lte: tuple }
		if (txId) this.log.read(txId, bounds)

		const items = this.storage.scan(bounds)
		return items.length > 0
	}

	scan(args: ScanArgs = {}, txId?: TxId): TupleValuePair[] {
		const { reverse, limit } = args
		const bounds = normalizeTupleBounds(args || {})
		if (txId) this.log.read(txId, bounds)
		return this.storage.scan({ ...bounds, reverse, limit })
	}

	indexers: Indexer[] = []

	index(indexer: Indexer) {
		this.indexers.push(indexer)
		return this
	}

	transact(txId?: TxId) {
		const id = txId || randomId()
		return new TupleTransaction(this, id)
	}

	commit(writes: Writes, txId?: string) {
		if (txId) this.log.commit(txId)
		for (const tuple of iterateWrittenTuples(writes)) {
			this.log.write(txId, tuple)
		}
		this.storage.commit(writes)
	}

	cancel(txId: string) {
		this.log.cancel(txId)
	}

	close() {
		this.storage.close()
	}
}

export class TupleTransaction {
	constructor(private storage: TupleDatabase, public id: TxId) {}

	writes: Required<Writes> = { set: [], remove: [] }

	get(tuple: Tuple) {
		// TODO: binary searching twice unnecessarily...
		if (tv.exists(this.writes.set, tuple)) {
			return tv.get(this.writes.set, tuple)
		}
		if (t.exists(this.writes.remove, tuple)) {
			return
		}
		return this.storage.get(tuple, this.id)
	}

	exists(tuple: Tuple) {
		if (tv.exists(this.writes.set, tuple)) {
			return true
		}
		if (t.exists(this.writes.remove, tuple)) {
			return false
		}
		return this.storage.exists(tuple, this.id)
	}

	set(tuple: Tuple, value: any) {
		// Don't fetch this if we don't need it for the indexers.
		const prev = this.storage.indexers.length ? this.get(tuple) : null
		t.remove(this.writes.remove, tuple)
		tv.set(this.writes.set, tuple, value)
		for (const indexer of this.storage.indexers) {
			indexer(this, { type: "set", tuple, value, prev })
		}
		return this
	}

	remove(tuple: Tuple) {
		// Don't fetch this if we don't need it for the indexers.
		const prev = this.storage.indexers.length ? this.get(tuple) : null
		tv.remove(this.writes.set, tuple)
		t.set(this.writes.remove, tuple)
		for (const indexer of this.storage.indexers) {
			indexer(this, { type: "remove", tuple, prev })
		}
		return this
	}

	write(writes: Writes) {
		// If you're calling this function, then the order of these opertions
		// shouldn't matter.
		const { set, remove } = writes
		for (const tuple of remove || []) {
			this.remove(tuple)
		}
		for (const [tuple, value] of set || []) {
			this.set(tuple, value)
		}
		return this
	}

	scan(args: ScanArgs = {}) {
		const result = this.storage.scan(args, this.id)
		const sets = tv.scan(this.writes.set, args)
		for (const [tuple, value] of sets) {
			tv.set(result, tuple, value)
		}
		const removes = t.scan(this.writes.remove, args)
		for (const tuple of removes) {
			tv.remove(result, tuple)
		}
		return result
	}

	commit() {
		return this.storage.commit(this.writes, this.id)
	}

	cancel() {
		return this.storage.cancel(this.id)
	}
}
