export type Value =
	| string
	| number
	| boolean
	| null
	| Array<Value>
	| { [key: string]: Value }

export type Tuple = Array<Value>

export const MIN = Symbol("min")
export const MAX = Symbol("max")

export type QueryValue = Value | typeof MIN | typeof MAX
export type QueryTuple = Array<QueryValue>

export type ScanArgs = {
	gt?: QueryTuple
	gte?: QueryTuple
	lt?: QueryTuple
	lte?: QueryTuple
	limit?: number
}

export interface ReadOnlyStorage {
	scan(index: string, args: ScanArgs): Array<Tuple>
}

export interface Storage {
	scan(index: string, args?: ScanArgs): Array<Tuple>
	transact(): Transaction
}

export type Writes = {
	[index: string]: { sets: Array<Tuple>; removes: Array<Tuple> }
}

export interface Transaction {
	writes: Writes
	scan(index: string, args?: ScanArgs): Array<Tuple>
	set(index: string, value: Tuple): void
	remove(index: string, value: Tuple): void
	commit(): void
}
