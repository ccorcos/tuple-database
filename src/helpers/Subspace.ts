import { Tuple } from "../storage/types"

// Subspace uses has tuple prefix and raw prefix
// https://github.com/apple/foundationdb/blob/dc3cebe8d904a704f734524943fc074dbaa59efc/bindings/python/fdb/subspace_impl.py

class Subspace {
	constructor(public prefix: Tuple) {}
	pack() {}
}

// Tuple range is as expected.
// https://github.com/apple/foundationdb/blob/dc3cebe8d904a704f734524943fc074dbaa59efc/bindings/python/fdb/tuple.py#L442
