import * as t from "../helpers/sortedTupleArray"
import * as tv from "../helpers/sortedTupleValuePairs"
import {
	Indexer,
	ScanArgs,
	Tuple,
	TupleStorage,
	TupleTransaction,
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

	commit(writes: Writes) {
		const { sets, removes } = writes
		for (const tuple of removes) {
			tv.remove(this.data, tuple)
		}
		for (const [tuple, value] of sets) {
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

export class InMemoryTransaction implements TupleTransaction {
	constructor(private storage: TransactionArgs) {}

	writes: Writes = { sets: [], removes: [] }

	get(tuple: Tuple) {
		// TODO: binary searching twice unnecessarily...
		if (tv.exists(this.writes.sets, tuple)) {
			return tv.get(this.writes.sets, tuple)
		}
		if (t.exists(this.writes.removes, tuple)) {
			return
		}
		return this.storage.get(tuple)
	}

	exists(tuple: Tuple) {
		if (tv.exists(this.writes.sets, tuple)) {
			return true
		}
		if (t.exists(this.writes.removes, tuple)) {
			return false
		}
		return this.storage.exists(tuple)
	}

	set(tuple: Tuple, value: any) {
		// Don't fetch this if we don't need it for the indexers.
		const prev = this.storage.indexers.length ? this.get(tuple) : null
		t.remove(this.writes.removes, tuple)
		tv.set(this.writes.sets, tuple, value)
		for (const indexer of this.storage.indexers) {
			indexer(this, { type: "set", tuple, value, prev })
		}
		return this
	}

	remove(tuple: Tuple) {
		// Don't fetch this if we don't need it for the indexers.
		const prev = this.storage.indexers.length ? this.get(tuple) : null
		tv.remove(this.writes.sets, tuple)
		t.set(this.writes.removes, tuple)
		for (const indexer of this.storage.indexers) {
			indexer(this, { type: "remove", tuple, prev })
		}
		return this
	}

	scan(args: ScanArgs = {}) {
		const result = this.storage.scan(args)
		const sets = tv.scan(this.writes.sets, args)
		for (const [tuple, value] of sets) {
			tv.set(result, tuple, value)
		}
		const removes = t.scan(this.writes.removes, args)
		for (const tuple of removes) {
			tv.remove(result, tuple)
		}
		return result
	}

	commit() {
		return this.storage.commit(this.writes)
	}
}
