import { TupleDatabase } from "../main"
import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
} from "./typeHelpers"
import { TupleValuePair } from "./types"

class SchemaDialect<S extends TupleValuePair = TupleValuePair> {
	constructor(private db: TupleDatabase, private prefix: any[] = []) {}

	scan<P extends TuplePrefix<S[0]>>(args: {
		prefix?: P
		gt?: P
		lt?: P
	}): FilterTupleValuePairByPrefix<S, P>[] {
		const prefixedArgs: any = { ...args }
		if (prefixedArgs.prefix)
			prefixedArgs.prefix = [...this.prefix, ...prefixedArgs.prefix]
		if (prefixedArgs.gt) prefixedArgs.gt = [...this.prefix, ...prefixedArgs.gt]
		if (prefixedArgs.lt) prefixedArgs.lt = [...this.prefix, ...prefixedArgs.lt]

		return this.db.scan(prefixedArgs) as any[]
	}

	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): SchemaDialect<RemoveTupleValuePairPrefix<S, P>> {
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

declare const x: SchemaDialect<Schema>
const y = x.scan({ prefix: ["recentFiles"] })

const xxx = x.subspace(["recentFiles"])
xxx.scan({ prefix: ["byPath"] })

declare const x1: SchemaDialect
const y1 = x1.scan({ prefix: ["recentFiles"] })

// TODO: how do we... make this simple to generalize. So we don't have type everything out again...
