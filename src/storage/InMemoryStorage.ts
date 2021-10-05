import * as t from "../helpers/sortedTupleArray"
import * as tv from "../helpers/sortedTupleValuePairs"
import {
	ScanArgs,
	Storage,
	Transaction,
	Tuple,
	TupleValuePair,
	Writes,
} from "./types"

export class InMemoryStorage implements Storage {
	data: TupleValuePair[]

	constructor(data?: TupleValuePair[]) {
		this.data = data || []
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
		return new InMemoryTransaction({
			get: (...args) => this.get(...args),
			exists: (...args) => this.exists(...args),
			scan: (...args) => this.scan(...args),
			commit: (...args) => this.commit(...args),
		})
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

interface TransactionArgs {
	get(tuple: Tuple): any
	exists(tuple: Tuple): boolean
	scan(args: ScanArgs): TupleValuePair[]
	commit(writes: Writes): void
}

export class InMemoryTransaction implements Transaction {
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
		t.remove(this.writes.removes, tuple)
		tv.set(this.writes.sets, tuple, value)
		return this
	}

	remove(tuple: Tuple) {
		tv.remove(this.writes.sets, tuple)
		t.set(this.writes.removes, tuple)
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
