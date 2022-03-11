import * as tv from "../helpers/sortedTupleValuePairs"
import { AbstractStorage } from "./AbstractStorage"
import { TupleValuePair } from "./types"

export class InMemoryStorage2 extends AbstractStorage {
	data: TupleValuePair[]

	constructor(data?: TupleValuePair[]) {
		super({
			scan: (args) => tv.scan(this.data, args),
			commit: (writes) => {
				// Indexers run inside the tx so we don't need to do that here.
				// And because of that, the order here should not matter.
				const { set, remove } = writes
				for (const tuple of remove || []) {
					tv.remove(this.data, tuple)
				}
				for (const [tuple, value] of set || []) {
					tv.set(this.data, tuple, value)
				}
			},
			close: () => {},
		})
		this.data = data || []
	}
}
