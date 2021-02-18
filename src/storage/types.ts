/*

Just basic JSON data-types. This is a pragmatic decision:
- If we have custom data types in here, we have to consider how to deserialize
	into different languages. For JavaScript, that means creating a class. But
	these classes don't serialize well over a JSON bridge between processes.
- The kind of data types we might want is endless. To start, I can think of
	{uuid: string}, {date: string} but then there's things like {url: string} or
	{phone: string} which dive deeper into application-level concepts.

So that is why this database layer only deals with JSON.
One exception is currently the MIN and MAX symbols... It would be nice to
redesign the semantics of the api to get rid of those.

*/
export type Value =
	| string
	| number
	| boolean
	| null
	| Array<Value>
	| { [key: string]: Value | undefined } // Undefined keys are ignored.
	| typeof MIN
	| typeof MAX

export type Tuple = Array<Value>

export const MIN = Symbol("min")
export const MAX = Symbol("max")

export type ScanArgs = {
	prefix?: Tuple
	gt?: Tuple
	gte?: Tuple
	lt?: Tuple
	lte?: Tuple
	limit?: number
}

export interface ReadOnlyStorage {
	scan(index: string, args: ScanArgs): Array<Tuple>
}

export type Writes = {
	[index: string]: { sets: Array<Tuple>; removes: Array<Tuple> }
}

export interface Storage {
	scan(index: string, args?: ScanArgs): Array<Tuple>
	transact(): Transaction
	commit(writes: Writes): void
}

export interface Transaction {
	writes: Writes
	scan(index: string, args?: ScanArgs): Array<Tuple>
	set(index: string, value: Tuple): Transaction
	remove(index: string, value: Tuple): Transaction
	commit(): void
}
