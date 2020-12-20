export type Value = string | number | boolean | null

export function isValue(x: any): x is Value {
	return (
		typeof x === "string" ||
		typeof x === "number" ||
		typeof x === "boolean" ||
		x === null
	)
}

export type Tuple = Array<Value>

export type Direction = 1 | -1

export type Sort = Array<Direction>

export type Index = {
	name: string
	sort: Sort
}

export type ScanArgs = {
	startAfter?: Tuple
	start?: Tuple
	endBefore?: Tuple
	end?: Tuple
	limit?: number
}

export interface ReadOnlyStorage {
	scan(index: Index, args: ScanArgs): Array<Tuple>
}

// TODO: rename to IndexStorage
export interface Storage {
	scan(index: Index, args?: ScanArgs): Array<Tuple>
	transact(): Transaction
}

// TODO: rename to IndexWrites
export type Writes = {
	[index: string]: { sort: Sort; sets: Array<Tuple>; removes: Array<Tuple> }
}

export interface Transaction {
	writes: Writes
	scan(index: Index, args?: ScanArgs): Array<Tuple>
	set(index: Index, value: Tuple): void
	remove(index: Index, value: Tuple): void
	commit(): void
}
