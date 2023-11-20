import { MAX, MIN, Tuple } from "../storage/types"

export type ScanArgs = {
	prefix?: Tuple
	gt?: AllowMinMax<Tuple>
	gte?: AllowMinMax<Tuple>
	lt?: AllowMinMax<Tuple>
	lte?: AllowMinMax<Tuple>
	limit?: number
	reverse?: boolean
}

type AllowMinMax<T extends Tuple> = {
	[K in keyof T]: T[K] | typeof MIN | typeof MAX
}

export type TxId = string

export type Unsubscribe = () => void
