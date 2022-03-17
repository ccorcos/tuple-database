import { Tuple, TupleValuePair } from "../storage/types"

export type Assert<Actual extends Expected, Expected> = Actual

// Can't create recursive string types, otherwise: `${Ints}${Ints}`
type Ints = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"

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
	S extends TupleValuePair,
	P extends Tuple
> = Extract<S, { 0: TupleToObject<P> }>

type A3 = Assert<
	FilterTupleValuePairByPrefix<
		[[1, 2], number] | [[1, 3], string] | [[2, 1], null],
		[1]
	>,
	[[1, 2], number] | [[1, 3], string]
>

export type FilterTupleValuePair<
	S extends TupleValuePair,
	P extends Tuple
> = Extract<S, { 0: P }>

type F1 = Assert<
	FilterTupleValuePair<
		[[1, 2], number] | [[1, 3], string] | [[2, 1], null],
		[1, 2]
	>,
	[[1, 2], number]
>

type DistributiveProp<T, K extends keyof T> = T extends unknown ? T[K] : never

export type ValueForTuple<
	S extends TupleValuePair,
	P extends Tuple
> = DistributiveProp<FilterTupleValuePairByPrefix<S, P>, 1>

type F2 = Assert<
	ValueForTuple<[[1, 2], number] | [[1, 3], string] | [[2, 1], null], [1, 2]>,
	number
>

type IsTuple = [] | { 0: any }
type A4 = Assert<[], IsTuple>
type A5 = Assert<[1, 2], IsTuple>
// @ts-expect-error is not a tuple.
type A6 = Assert<any[], IsTuple>

export type TuplePrefix<T extends unknown[]> = T extends IsTuple
	? T extends [any, ...infer U]
		? [] | [T[0]] | [T[0], ...TuplePrefix<U>]
		: []
	: T
type A7 = Assert<TuplePrefix<[1, 2, 3]>, [] | [1] | [1, 2] | [1, 2, 3]>
// @ts-expect-error missing a prefix []
type A77 = Assert<TuplePrefix<[1, 2, 3]>, [1] | [1, 2] | [1, 2, 3]>
type A777 = Assert<TuplePrefix<string[]>, string[]>

export type TupleRest<T extends unknown[]> = T extends [any, ...infer U]
	? U
	: never

type A8 = Assert<TupleRest<[1, 2, 3]>, [2, 3]>

export type RemoveTuplePrefix<T, P extends any[]> = T extends [...P, ...infer U]
	? U
	: never

type A9 = Assert<RemoveTuplePrefix<[1, 2, 3], [1, 2]>, [3]>
type A10 = Assert<RemoveTuplePrefix<[1, 2, 3], [1]>, [2, 3]>
type A11 = Assert<RemoveTuplePrefix<[1, 2, 3], [2]>, never>

export type RemoveTupleValuePairPrefix<T, P extends any[]> = T extends {
	0: [...P, ...infer U]
	1: infer V
}
	? [U, V]
	: never

type A12 = Assert<
	RemoveTupleValuePairPrefix<[[1, 2, 3], null], [1, 2]>,
	[[3], null]
>
type A13 = Assert<
	RemoveTupleValuePairPrefix<[[1, 2, 3], string], [1]>,
	[[2, 3], string]
>
type A14 = Assert<RemoveTupleValuePairPrefix<[[1, 2, 3], string], [2]>, never>

// Using the DistributiveProp trick here too.
export type SchemaSubspace<
	T extends TupleValuePair,
	P extends Tuple
> = T extends unknown ? [[...P, ...T[0]], T[1]] : never

type A15 = Assert<
	SchemaSubspace<[[1], 1] | [[2], 2], ["int"]>,
	[["int", 1], 1] | [["int", 2], 2]
>
