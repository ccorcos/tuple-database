import * as tv from "../helpers/sortedTupleValuePairs"
import { ScanStorageArgs, TupleStorage, TupleValuePair, Writes } from "./types"

export class InMemoryTupleStorage implements TupleStorage {
	data: TupleValuePair[]

	constructor(data?: TupleValuePair[]) {
		this.data = data || []
	}

	scan(args?: ScanStorageArgs) {
		return tv.scan(this.data, args)
	}

	commit(writes: Writes) {
		// Indexers run inside the tx so we don't need to do that here.
		// And because of that, the order here should not matter.
		const { set, remove } = writes
		for (const tuple of remove || []) {
			tv.remove(this.data, tuple)
		}
		for (const [tuple, value] of set || []) {
			tv.set(this.data, tuple, value)
		}
	}

	close() {}
}
