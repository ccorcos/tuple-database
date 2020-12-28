import { Tuple, ScanArgs, Writes, Storage, Transaction } from "./types"
import { scan, remove, set } from "../helpers/sortedTupleArray"

export class InMemoryStorage implements Storage {
	map: { [index: string]: Array<Tuple> } = {}

	scan(index: string, args: ScanArgs = {}) {
		const data = this.map[index] || []
		return scan(data, args)
	}

	transact() {
		return new InMemoryTransaction({
			scan: (...args) => this.scan(...args),
			commit: (...args) => this.commit(...args),
		})
	}

	commit(writes: Writes) {
		for (const [name, { sets, removes }] of Object.entries(writes)) {
			if (!this.map[name]) {
				this.map[name] = []
			}
			for (const tuple of removes) {
				remove(this.map[name], tuple)
			}
			for (const tuple of sets) {
				set(this.map[name], tuple)
			}
		}
	}
}

interface TransactionArgs {
	scan(index: string, args: ScanArgs): Array<Tuple>
	commit(writes: Writes): void
}

export class InMemoryTransaction implements Transaction {
	constructor(private storage: TransactionArgs) {}

	writes: Writes = {}

	set(index: string, value: Tuple) {
		if (!this.writes[index]) {
			this.writes[index] = { sets: [], removes: [] }
		}
		remove(this.writes[index].removes, value)
		set(this.writes[index].sets, value)
		return this
	}

	remove(index: string, value: Tuple) {
		if (!this.writes[index]) {
			this.writes[index] = { sets: [], removes: [] }
		}
		remove(this.writes[index].sets, value)
		set(this.writes[index].removes, value)
		return this
	}

	scan(index: string, args: ScanArgs = {}) {
		const result = this.storage.scan(index, args)
		if (this.writes[index]) {
			const sets = scan(this.writes[index].sets, args)
			for (const tuple of sets) {
				set(result, tuple)
			}
			const removes = scan(this.writes[index].removes, args)
			for (const tuple of removes) {
				remove(result, tuple)
			}
		}
		return result
	}

	commit() {
		return this.storage.commit(this.writes)
	}
}
