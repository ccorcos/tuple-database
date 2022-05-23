# Motivation

I designed this database with lots of fairly niche constraints in mind.

1. Local-First

	I subscribe to all of the motivations listed in the [Local-First Software](https://www.inkandswitch.com/local-first/) article. But the more acute reason for me is that it **frees developers from the endless maintenance** of a gigantic multi-tenant system. When users own all of their data on their devices, it's a natural way of sharding a database and scaling up a platform.

	As a constraint, this means that I'm interested in building an embedded database, like SQLite or LevelDb, that runs in process and is intended to me single tenant. That means we don't need to worry about certain kinds of scale or clustering / replicas.

2. Reactive Queries

	Polished applications these days require realtime reactivity. And it's not just for collaboration -- reactivity necessary when a user has multiple windows or tabs showing the same data.

	Many systems have record-level or table-level reactivity, but I want **all queries to be reactive**. I'm tired of having to engineer custom solutions on top of databases with brittle logic where a developer might forget to emit an update event.

3. Schemaless

	It took me some time to realize the the value of maintaining schemas in the application rather than the database. This was motivated by two use-cases I had in mind:

	- It's incredibly difficult to **sync data peer-to-peer** when clients may have different versions of a schema that are strictly enforced by the database. Instead, a schemaless database should be flexible enough to accept incoming data and allow the application to resolve conflicts or schema issues.

	- I want to build apps like Notion and Airtable where **end-users define their own schemas**. I call this an "end-user database". Granted, you can use SQLite and run `ALTER TABLE` commands, but this becomes pretty difficult to keep track of, especially once we start to consider indexing and many-to-many relationships. A schemaless database provides the flexibility necessary to create an object with a dynamic property that can also get indexed.

4. Directly Manipulate Indexes

	I've spent way to much time in Postgres manually denormalizing data and constructing elaborate indexes that perfectly complement a complex query with the goal of `EXPLAIN` outputting `INDEX ONLY SCAN` for optimal performance. This dance is a tiresome incidental complexity for application development.

	The query optimizer is the most valuable part about SQL, leveraging a variety of indexes to answer a wide variety of queries as efficiently as possible. This makes sense for business intelligence where you run a wide variety of different queries. But typical applications tend to ask a few unchanging queries many times. Thus the query optimizer is a useless indirection for a developer trying to design for a specific set of queries. I want to bypassing the query optimizer altogether to **read and write directly to/from indexes**.

	So long as we can **transactionally read and write indexes** using arbitrary logic ([like you can with FoundationDb](https://apple.github.io/foundationdb/developer-guide.html#transaction-basics)), then we can drop down to a lower level of abstraction and deal with indexes directly instead of using DDL.

	- Many-to-many relationships are incredibly common in applications today. Many users can belong to many group chats; many pages and have many tags; many users can follow many users.

		Yet SQL does not provide a way of indexing queries that involve a `JOIN`. Social apps that want to query "what are all the posts of all the people I follow ordered in time" must design their own systems because SQL cannot index that query (SQL will need to load all of the posts of all the people you follow over all time, and sort them in memory!).

		**Indexing any-to-many relationships** is a use-case we get for free as a consequence of being able to directly manipulate indexes.

5. Asynchonous or Synchronous, Persisted or In-Memory Storage

	Obviously, I want to be able to persist data. And most persistence layers are asynchronous: LevelDb or even a cloud database. But even when persistence is synchronous, like SQLite, you might have to asynchronously cross a process boundary, such as a window interacting with a database on the main process.

	But a non-trivial use-case is that I want to use a **synchronous in-memory database for frontend state management** in my application. I'm building apps using React.js and web technologies these days, so synchronous updates are necessary for certain kinds of interactions. For example, effects like opening a link must occur in the same event loop as the user interaction, otherwise the browser won't respond.

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
