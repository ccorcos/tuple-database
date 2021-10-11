import { MAX, MIN, ScanArgs, Tuple } from "../storage/types"

// Similar to FoundationDb's abstraction.
// https://github.com/apple/foundationdb/blob/dc3cebe8d904a704f734524943fc074dbaa59efc/bindings/python/fdb/subspace_impl.py
export class Subspace {
	public prefix: Tuple
	constructor(...prefix: Tuple) {
		this.prefix = prefix
	}
	pack(rest: Tuple) {
		return [...this.prefix, ...rest]
	}
	unpack(tuple: Tuple) {
		return tuple.slice(this.prefix.length)
	}
	subspace(...more: Tuple) {
		return new Subspace(...this.pack(more))
	}
	range(tuple: Tuple = []): ScanArgs {
		return {
			gte: this.pack([...tuple, MIN]),
			lte: this.pack([...tuple, MAX]),
		}
	}
	// contains(tuple: Tuple): boolean
}
