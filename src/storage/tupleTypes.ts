import { TupleDatabase } from "../main"
import { Tuple, TupleValuePair } from "./types"

type Ints = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
// | `${Ints}${Ints}`

type TupleToObject<T extends any[]> = Pick<T, Extract<keyof T, Ints>>

type FilterByPrefix<S extends TupleValuePair, P extends Tuple> = Extract<
	S,
	{ 0: TupleToObject<P> }
>

type IsTuple = [] | { 0: any }

type TuplePrefix<T extends unknown[]> = T extends IsTuple
	? T extends [any, ...infer U]
		? [] | [T[0]] | [T[0], ...TuplePrefix<U>]
		: []
	: T

type TupleRest<T extends unknown[]> = T extends [any, ...infer U] ? U : never

type RemovePrefix<T, P extends any[]> = T extends {
	0: [...P, ...infer U]
	1: infer V
}
	? [U, V]
	: never

class SchemaDialect<S extends TupleValuePair = TupleValuePair> {
	constructor(private db: TupleDatabase, private prefix: any[] = []) {}

	scan<P extends TuplePrefix<S[0]>>(args: {
		prefix?: P
		gt?: P
		lt?: P
	}): FilterByPrefix<S, P>[] {
		const prefixedArgs: any = { ...args }
		if (prefixedArgs.prefix)
			prefixedArgs.prefix = [...this.prefix, ...prefixedArgs.prefix]
		if (prefixedArgs.gt) prefixedArgs.gt = [...this.prefix, ...prefixedArgs.gt]
		if (prefixedArgs.lt) prefixedArgs.lt = [...this.prefix, ...prefixedArgs.lt]

		return this.db.scan(prefixedArgs) as any[]
	}

	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): SchemaDialect<RemovePrefix<S, P>> {
		return new SchemaDialect(this.db, [...this.prefix, ...prefix]) as any
	}
}

// | [["eav", string, string, string | number], null]
// | [["ave", string, string | number, string], null]
// | [["vea", string | number, string, string], null]

type Schema =
	| [["link", string, string], null]
	| [["backlink", string, string], null]
	| [["recentFiles", "byPath", string, number], null]
	| [["recentFiles", "byTime", number, string], null]

type X = TuplePrefix<Tuple>

declare const x: SchemaDialect<Schema>
const y = x.scan({ prefix: ["recentFiles"] })

const xxx = x.subspace(["recentFiles"])
xxx.scan({ prefix: ["byPath"] })

declare const x1: SchemaDialect
const y1 = x1.scan({ prefix: ["recentFiles"] })

// TODO: what about generic tuples though.
