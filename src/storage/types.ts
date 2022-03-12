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
	| object
	| typeof MIN
	| typeof MAX

export type Tuple = Value[]

export type TupleValuePair = [Tuple, any]

// If keys were always encoded when they were stored, we could add a \x00 or \xFF byte to
// the end of the encoded tuple key in order to do prefix queries. However, we don't want
// to serialize data when it is stored and queried in memory, thus we need to have a MIN
// and MAX abstraction such as this.
export const MIN = Symbol("min")
export const MAX = Symbol("max")

export type ScanArgs = {
	gt?: Tuple
	gte?: Tuple
	lt?: Tuple
	lte?: Tuple
	prefix?: Tuple
	limit?: number
	reverse?: boolean
}

// TODO: call this a "Write" or a "Commit"
export type Writes = { set?: TupleValuePair[]; remove?: Tuple[] }

export type Operation =
	| { type: "set"; tuple: Tuple; value: any; prev: any }
	| { type: "remove"; tuple: Tuple; prev: any }

export type TxId = string

export type ScanStorageArgs = {
	gt?: Tuple
	gte?: Tuple
	lt?: Tuple
	lte?: Tuple
	limit?: number
	reverse?: boolean
}

export type Callback = (write: Writes) => void
export type Unsubscribe = () => void
