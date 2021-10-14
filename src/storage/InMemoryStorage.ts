import * as t from "../helpers/sortedTupleArray"
import * as tv from "../helpers/sortedTupleValuePairs"
import {
	Indexer,
	ScanArgs,
	Transaction,
	Tuple,
	TupleStorage,
	TupleValuePair,
	Writes,
} from "./types"

export class InMemoryStorage implements TupleStorage {
	data: TupleValuePair[]

	constructor(data?: TupleValuePair[]) {
		this.data = data || []
	}

	indexers: Indexer[] = []

	index(indexer: Indexer) {
		this.indexers.push(indexer)
		return this
	}

	get(tuple: Tuple) {
		return tv.get(this.data, tuple)
	}

	exists(tuple: Tuple) {
		return tv.exists(this.data, tuple)
	}

	scan(args: ScanArgs = {}) {
		return tv.scan(this.data, args)
	}

	transact() {
		return new InMemoryTransaction(this)
	}

	// TODO: it's unclear what the consequences are of this ordering.
	// Also, if we were to run more indexers after this bulk write, what are the race conditions?
	commit(writes: Writes) {
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

export interface TransactionArgs {
	indexers: Indexer[]
	get(tuple: Tuple): any
	exists(tuple: Tuple): boolean
	scan(args: ScanArgs): TupleValuePair[]
	commit(writes: Writes): void
}

export class InMemoryTransaction implements Transaction {
	constructor(private storage: TransactionArgs) {}

	writes: Required<Writes> = { set: [], remove: [] }

	get(tuple: Tuple) {
		// TODO: binary searching twice unnecessarily...
		if (tv.exists(this.writes.set, tuple)) {
			return tv.get(this.writes.set, tuple)
		}
		if (t.exists(this.writes.remove, tuple)) {
			return
		}
		return this.storage.get(tuple)
	}

	exists(tuple: Tuple) {
		if (tv.exists(this.writes.set, tuple)) {
			return true
		}
		if (t.exists(this.writes.remove, tuple)) {
			return false
		}
		return this.storage.exists(tuple)
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
		const result = this.storage.scan(args)
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
		return this.storage.commit(this.writes)
	}
}
