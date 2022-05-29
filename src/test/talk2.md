
# How does it work?

- A Value is any valid JSON (and two special MIN and MAX symbols but ignore that for now).
- A Tuple is Value[].
- A Value is orderable
	- number, string (obv), boolean: true > false
	- arrays are compound sorted -> same as Tuple.
	- objects are ordered dictionaries
		should we do `[key, value][]` or `[key[], value[]]`?
		not particularly useful yet; mostly used for "named" values like `{id: string}`
	- Value *types* are ordered number boolean > string > number > array > object.
		It's arbitrary but necessary to store all tuples in an ordered list.

Fundamentally, this is like a key-value store where a key is a tuple. Keys are unique.

And so here is the lowest level storage layer:

- Storage Layer is just two things
	- write({set?: TupleValue[], remove?: Tuple[]}): void
	- scan({
			gt?: Tuple,
			gte?: Tuple,
			lt?: Tuple,
			lte?: Tuple,
			reverse?: boolean,
			limit?: number
		}): TupleValue[]

Can be sync or async.

We have storage interfaces for SQLite, LevelDb, FileSystem, and InMemory.

- Database layer is just two more things.
	- conccurrency control
	- reactivity

- concurrency control is simple
	- txId is randomly generated
	- scan(bounds, txId)
	- write(ops, txId)
	- keep track in a log
	- on write, loop through log starting at first read of this txId, and look for writes conflicting those reads.
	- if there's a conflict, reject and retry.
	- prune the log.

- reactivity is fairly simple as well
	- `const unsubscribe = db.subscribe(bounds, (ops) => void)`
	- technically this is a "spatial query" to emit updates.
		a subscriptions is just a range (lo, hi).
		a write op looks for intersecting ranges.
	* This means that scan(bounds) is not an ideal abstraction.
		- segment tree is this base case.
			- interval tree is what you need to overlapping date ranges like a calendar app.
			- range tree is the general solution, rtree in postgres.
			- kd-tree is a space partitioning
		- many databases like leveldb do not have a native rtree implementation.
			non-native rtree storage would require successive reads as opposed to one atomic scan.
			sqlite has an r*tree module extension, but not default.
		- kd-tree is a space partitioning technique.
			we can interpret keys as partitions.
			bounds often share a prefix.
		- current implemetation queries for prefixes.


The client layer is were all the DX sugar comes in.

- scan({prefix: [x]}) unfolds into {gte: [x, MIN], lte: [x, MAX]}.
	- that's why we have MIN and MAX. its annoying, but you need it.
- subspace([x]) prepends [x] to all tuples, "zooming in".
	- useful for re-using logic
	- some state doesn't need to know where it is in the global namespace.
- get(tuple) shorthand for scan(gte,lte,limit:1)[0].value
- transact()
	- .set(tuple, value)
	- .remove(tuple)
	- .get(tuple) and .scan(bounds) is effected by yet-to-be-committed operations.
	- .commit()
- Schema types
	```ts
	type ContactsSchema =
		| {key: ["person", {id: string}], value: {id: string, name: string}}
		| {key: ["personByName", {name: string}, {id: string}], value: null}
	```
	- `{named: Value}` is a nice pattern here.
	- useful helper function:
		`namedTupleToObject(["personByName", {name: string}, {id: string}])`
		-> `{name: string, id: string}`

Some other useful helper functions:
- subscribeQuery:
	`cons [initialResult, unsubscribe] = subscribeQuery(db, (db, ...args) => result, [...args], newResult => void)`
- useTupleDatabase if you're using React:
	`const result = useTupleDatabase(db, (db, ...args) => result, [...args])`
- transactionalQuery:
	`const doX = transactionalQuery<Schema>()(tx, ...args) => { ... })`
	if `doX(db, ...args)` then will open a transaction, commit, and retry on conflict. must be idempotent.
	if `doX(tx, ...args)`, then will not open or commit a transaction. allows for nice composability.


---

What are some cool things you can build with it?

- basic frontend state management.
	- no more issue with writing to multiple stores non-transacitonally. re-render inbetween writes causes an error.
	- efficient reactivity and updates.
	- synchronous updates, important for browsers.
	- handles normalization and denormalization.

- you can build a social app with proper indexes and great performance.
	- SQL has issues, can't index join followers against posts, sort all posts of all time in-memory.

- you can build an end-user database.
	- user-defined properties
	- user-defined filters
	- indexes on user-defined filters

---

Future work:
- generalizing api to support native rtrees
	- better way to handle reactivity.
	- necessary for calendars or geo data.
- build a custom storage.

---
