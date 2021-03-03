import _ from "lodash"
import { groupBy } from "lodash"
import { Tuple, Value } from "../storage/types"

// Indexes as cached queries that incrementally update.
// Lets leave out any concept of a query planner. This is lower-level. Is it? It's not...

const index = {
	// Indexing a list of all values and what item the belong to in which lists.
	query: [
		["ave", [{ id: "type" }, { id: "List" }, { var: "list" }]],
		["eav", [{ var: "list" }, { id: "item" }, { var: "item" }]],
		["eav", [{ var: "item" }, { id: "value" }, { var: "value" }]],
	],
	result: [
		"value-list-item",
		[{ var: "value" }, { var: "list" }, { var: "item" }],
	],
}

type Var = { var: string }

// Now we're on to evaluating queries... And updating indexes...
// This means, we need some amount of query planning for computing the "rest" of a query for a given update.
// This is a higher level concept than strictly a tuple database...
// We should generalize the "ReactiveStorage" so we can re-use these primitives for indexing.

// Sounds like we're approaching where I was last think week!
// 1. do we need to worry about sort direction? maybe a later iteration. maybe by that time, we'll have

// tuple-indexer
// - no sort direction.
// - query planner, but no heuristics yet?
// -
