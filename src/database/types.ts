import { MAX, MIN, Tuple } from "../storage/types"
import { RemoveTuplePrefix, TuplePrefix } from "./typeHelpers"

export type ScanArgs<
	T extends Tuple,
	P extends TuplePrefix<T>
> = PrefixScanArgs<T, P>

export type PrefixScanArgs<T extends Tuple, P extends TuplePrefix<T>> = {
	prefix?: P
	gt?: AllowMinMax<RemoveTuplePrefix<T, P>>
	gte?: AllowMinMax<RemoveTuplePrefix<T, P>>
	lt?: AllowMinMax<RemoveTuplePrefix<T, P>>
	lte?: AllowMinMax<RemoveTuplePrefix<T, P>>
	limit?: number
	reverse?: boolean
}

type AllowMinMax<T extends Tuple> = {
	[K in keyof T]: T[K] | typeof MIN | typeof MAX
}

export type TxId = string

export type Unsubscribe = () => void
