import { iterateWrittenTuples } from "../helpers/iterateTuples"
import { randomId } from "../helpers/randomId"
import * as t from "../helpers/sortedTupleArray"
import * as tv from "../helpers/sortedTupleValuePairs"
import { ConcurrencyLog } from "./ConcurrencyLog"
import {
	Indexer,
	ScanArgs,
	Transaction,
	Tuple,
	TupleStorage,
	TupleValuePair,
	TxId,
	Writes,
} from "./types"

export class InMemoryStorage implements TupleStorage {
	data: TupleValuePair[]
	indexers: Indexer[] = []
	log = new ConcurrencyLog()

	constructor(data?: TupleValuePair[]) {
		this.data = data || []
	}

	index(indexer: Indexer) {
		this.indexers.push(indexer)
		return this
	}

	get(tuple: Tuple, txId?: TxId) {
		if (txId) this.log.read(txId, { gte: tuple, lte: tuple })
		return tv.get(this.data, tuple)
	}

	exists(tuple: Tuple, txId?: TxId) {
		if (txId) this.log.read(txId, { gte: tuple, lte: tuple })
		return tv.exists(this.data, tuple)
	}

	scan(args: ScanArgs = {}, txId?: TxId) {
		if (txId) this.log.read(txId, t.normalizeTupleBounds(args))
		return tv.scan(this.data, args)
	}

	transact(txId?: TxId) {
		const id = txId || randomId()
		return new InMemoryTransaction(this, id)
	}

	// TODO: it's unclear what the consequences are of this ordering.
	// Also, if we were to run more indexers after this bulk write, what are the race conditions?
	commit(writes: Writes, txId?: string) {
		if (txId) this.log.commit(txId)
		for (const tuple of iterateWrittenTuples(writes)) {
			this.log.write(txId, tuple)
		}

		const { set, remove } = writes
		for (const tuple of remove || []) {
			tv.remove(this.data, tuple)
		}
		for (const [tuple, value] of set || []) {
			tv.set(this.data, tuple, value)
		}
	}

	close() {
		// Nothing happens really. This is more important for SQLite.
		return
	}
}

export type TransactionArgs = {
	indexers: Indexer[]
	get(tuple: Tuple, txId: TxId): any
	exists(tuple: Tuple, txId: TxId): boolean
	scan(args: ScanArgs, txId: TxId): TupleValuePair[]
	commit(writes: Writes, txId: TxId): void
}

export class InMemoryTransaction implements Transaction {
	constructor(private storage: TransactionArgs, public id: TxId) {}

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
		// TODO: it's unclear what the consequences are of this ordering.
		// Also, if we were to run more indexers after this bulk write, what are the race conditions?
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
}
