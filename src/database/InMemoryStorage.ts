import { Tuple, Index, Writes } from "./storage"
import { ScanArgs, Storage, Transaction } from "./storage"
import { scan, remove, set } from "./indexHelpers"

export class InMemoryStorage implements Storage {
	map: { [index: string]: Array<Tuple> } = {}

	scan(index: Index, args: ScanArgs = {}) {
		const { name, sort } = index
		const data = this.map[name] || []
		return scan(sort, data, args)
	}

	transact() {
		return new InMemoryTransaction({
			scan: (index, args) => this.scan(index, args),
			commit: writes => {
				for (const [name, { sets, removes, sort }] of Object.entries(writes)) {
					if (!this.map[name]) {
						this.map[name] = []
					}
					// TODO: more efficent merge.
					for (const tuple of removes) {
						remove(sort, this.map[name], tuple)
					}
					for (const tuple of sets) {
						set(sort, this.map[name], tuple)
					}
				}
			},
		})
	}
}

interface TransactionArgs {
	scan(index: Index, args: ScanArgs): Array<Tuple>
	commit(writes: Writes): void
}

export class InMemoryTransaction implements Transaction {
	constructor(private storage: TransactionArgs) {}

	writes: Writes = {}

	set(index: Index, value: Tuple) {
		const { name, sort } = index
		if (!this.writes[name]) {
			this.writes[name] = { sets: [], removes: [], sort }
		}
		remove(sort, this.writes[name].removes, value)
		set(sort, this.writes[name].sets, value)
		return this
	}

	remove(index: Index, value: Tuple) {
		const { name, sort } = index
		if (!this.writes[name]) {
			this.writes[name] = { sets: [], removes: [], sort }
		}
		remove(sort, this.writes[name].sets, value)
		set(sort, this.writes[name].removes, value)
		return this
	}

	scan(index: Index, args: ScanArgs = {}) {
		const { name, sort } = index
		const result = this.storage.scan(index, args)
		if (this.writes[name]) {
			const sets = scan(sort, this.writes[name].sets, args)
			// TODO: more efficent merge.
			for (const tuple of sets) {
				set(sort, result, tuple)
			}
			const removes = scan(sort, this.writes[name].removes, args)
			for (const tuple of removes) {
				remove(sort, result, tuple)
			}
		}
		return result
	}

	commit() {
		return this.storage.commit(this.writes)
	}
}
