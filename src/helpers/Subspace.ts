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

export type TuplePrefix<T extends unknown[]> = T extends [any, ...infer U]
	? [] | [T[0]] | [T[0], ...TuplePrefix<U>]
	: []

export type TupleRest<T extends unknown[]> = T extends [any, ...infer U]
	? U
	: never

export type TupleAfterPrefix<
	P extends unknown[],
	T extends unknown[]
> = P extends [any, ...infer U] ? TupleAfterPrefix<U, TupleRest<T>> : T

export class Subspace2<Prefix extends Tuple, Rest extends Tuple> {
	public prefix: Prefix
	constructor(...prefix: Prefix) {
		this.prefix = prefix
	}
	pack(rest: Rest): [...Prefix, ...Rest] {
		return [...this.prefix, ...rest]
	}
	unpack(tuple: Tuple) {
		return tuple.slice(this.prefix.length) as Rest
	}
	subspace<More extends TuplePrefix<Rest>>(...more: More) {
		return new Subspace2<
			[...Prefix, ...More],
			[...Prefix, ...TupleAfterPrefix<More, Rest>]
		>(...(this.pack(more as any) as any))
	}
	range(tuple: TuplePrefix<Rest> = []): ScanArgs {
		return {
			gte: this.pack([...tuple, MIN] as any),
			lte: this.pack([...tuple, MAX] as any),
		}
	}
	// contains(tuple: Tuple): boolean
}
