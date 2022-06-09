import { KeyValuePair, Tuple } from "../storage/types"

export type Assert<Actual extends Expected, Expected> = Actual

// Can't create recursive string types, otherwise: `${Ints}${Ints}`
export type Ints =
	| "0"
	| "1"
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "10"

/** Convert ["a", "b"] in {0: "a", 1: "b"} so that we can use Extract to match tuple prefixes. */
export type TupleToObject<T extends any[]> = Pick<T, Extract<keyof T, Ints>>

type A1 = Assert<TupleToObject<[1, 2]>, { 0: 1; 1: 2 }>

export type FilterTupleByPrefix<S extends Tuple, P extends Tuple> = Extract<
	S,
	TupleToObject<P>
>
type A2 = Assert<
	FilterTupleByPrefix<[1, 2] | [1, 3] | [2, 1], [1]>,
	[1, 2] | [1, 3]
>
// @ts-expect-error missing a tuple that should be filtered.
type A22 = Assert<FilterTupleByPrefix<[1, 2] | [1, 3] | [2, 1], [1]>, [1, 2]>

export type FilterTupleValuePairByPrefix<
	S extends KeyValuePair,
	P extends Tuple
> = Extract<S, { key: TupleToObject<P> }>

type A3 = Assert<
	FilterTupleValuePairByPrefix<
		| { key: [1, 2]; value: number }
		| { key: [1, 3]; value: string }
		| { key: [2, 1]; value: null },
		[1]
	>,
	{ key: [1, 2]; value: number } | { key: [1, 3]; value: string }
>

export type FilterTupleValuePair<
	S extends KeyValuePair,
	P extends Tuple
> = Extract<S, { key: P }>

type F1 = Assert<
	FilterTupleValuePair<
		| { key: [1, 2]; value: number }
		| { key: [1, 3]; value: string }
		| { key: [2, 1]; value: null },
		[1, 2]
	>,
	{ key: [1, 2]; value: number }
>

type DistributiveProp<T, K extends keyof T> = T extends unknown ? T[K] : never

export type ValueForTuple<
	S extends KeyValuePair,
	P extends Tuple
> = DistributiveProp<FilterTupleValuePairByPrefix<S, P>, "value">

type F2 = Assert<
	ValueForTuple<
		| { key: [1, 2]; value: number }
		| { key: [1, 3]; value: string }
		| { key: [2, 1]; value: null },
		[1, 2]
	>,
	number
>

export type IsTuple = [] | { 0: any }
type A4 = Assert<[], IsTuple>
type A5 = Assert<[1, 2], IsTuple>
// @ts-expect-error is not a tuple.
type A6 = Assert<any[], IsTuple>

export type TuplePrefix<T extends unknown[]> = T extends IsTuple
	? T extends [any, ...infer U]
		? [] | [T[0]] | [T[0], ...TuplePrefix<U>]
		: []
	: T | []

type A7 = Assert<TuplePrefix<[1, 2, 3]>, [] | [1] | [1, 2] | [1, 2, 3]>
// @ts-expect-error missing a prefix []
type A77 = Assert<TuplePrefix<[1, 2, 3]>, [1] | [1, 2] | [1, 2, 3]>
type A777 = Assert<TuplePrefix<string[]>, string[]>

export type TupleRest<T extends unknown[]> = T extends [any, ...infer U]
	? U
	: never

type A8 = Assert<TupleRest<[1, 2, 3]>, [2, 3]>

export type RemoveTuplePrefix<T, P extends any[]> = T extends IsTuple
	? T extends [...P, ...infer U]
		? U
		: never
	: T

type A9 = Assert<RemoveTuplePrefix<[1, 2, 3], [1, 2]>, [3]>
type A10 = Assert<RemoveTuplePrefix<[1, 2, 3], [1]>, [2, 3]>
type A11 = Assert<RemoveTuplePrefix<[1, 2, 3], [2]>, never>

export type RemoveTupleValuePairPrefix<
	T extends KeyValuePair,
	P extends any[]
> = T extends {
	key: [...P, ...infer U]
	value: infer V
}
	? { key: U; value: V }
	: never

type A12 = Assert<
	RemoveTupleValuePairPrefix<{ key: [1, 2, 3]; value: null }, [1, 2]>,
	{ key: [3]; value: null }
>
type A13 = Assert<
	RemoveTupleValuePairPrefix<{ key: [1, 2, 3]; value: string }, [1]>,
	{ key: [2, 3]; value: string }
>
type A14 = Assert<
	RemoveTupleValuePairPrefix<{ key: [1, 2, 3]; value: string }, [2]>,
	never
>

// Using the DistributiveProp trick here too.
export type SchemaSubspace<
	P extends Tuple,
	T extends KeyValuePair
> = T extends unknown
	? {
			key: [...P, ...T["key"]]
			value: T["value"]
	  }
	: never

type A15 = Assert<
	SchemaSubspace<["int"], { key: [1]; value: 1 } | { key: [2]; value: 2 }>,
	{ key: ["int", 1]; value: 1 } | { key: ["int", 2]; value: 2 }
>

export type PrefixForSubspace<
	Schema extends KeyValuePair,
	Subspace extends KeyValuePair
> = Schema extends {
	key: [...infer U, ...Subspace["key"]]
	value: Subspace["value"]
}
	? U
	: never

type A16 = Assert<
	PrefixForSubspace<
		| { key: [number]; value: number }
		| { key: ["a", number]; value: number }
		| { key: ["b", number]; value: number }
		| { key: ["b", "b", number]; value: number }
		| { key: ["c", string]; value: number }
		| { key: ["d", number]; value: string },
		{ key: [number]; value: number }
	>,
	["a"] | ["b"] | [] | ["b", "b"]
>
