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
	data: TupleValuePair[] = []

	scan(args: ScanArgs = {}) {
		return tv.scan(this.data, args)
	}

	transact() {
		return new InMemoryTransaction({
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
}

interface TransactionArgs {
	scan(args: ScanArgs): TupleValuePair[]
	commit(writes: Writes): void
}

export class InMemoryTransaction implements Transaction {
	constructor(private storage: TransactionArgs) {}

	writes: Writes = { sets: [], removes: [] }

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
