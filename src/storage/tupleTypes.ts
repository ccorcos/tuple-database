import { Tuple, TupleValuePair } from "./types"

// | [["eav", string, string, string | number], null]
// | [["ave", string, string | number, string], null]
// | [["vea", string | number, string, string], null]

type Schema =
	| [["link", string, string], null]
	| [["backlink", string, string], null]
	| [["recentFiles", "byPath", string, number], null]
	| [["recentFiles", "byTime", number, string], null]

type Ints = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
// | `${Ints}${Ints}`

type TupleToObject<T extends any[]> = Pick<T, Extract<keyof T, Ints>>

type FilterByPrefix<S extends TupleValuePair, P extends Tuple> = Extract<
	S,
	{ 0: TupleToObject<P> }
>

// type Z = [] extends { 0: any } ? true : false

type a = TuplePrefix<[1, 2, 3]>

type TuplePrefix<T extends unknown[]> = T extends [any, ...infer U]
	? [] | [T[0]] | [T[0], ...TuplePrefix<U>]
	: []

class SchemaDialect<S extends TupleValuePair> {
	scan<P extends TuplePrefix<S[0]>>(args: {
		prefix?: P
		gt?: P
		lt?: P
	}): FilterByPrefix<S, P>[] {
		return [] // TODO
	}

	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): SchemaDialect<FilterByPrefix<S, P>> {
		return {} as any // TODO
	}
}

type X = TuplePrefix<Tuple>

declare const x: SchemaDialect<Schema>
const y = x.scan({ prefix: ["recentFiles"] })
