# Tuple Database

- Embedded database, designed for [Local-First Software](https://www.inkandswitch.com/local-first/).
- All queries are reactive.
- Schemaless -- schemas are enforced by the application, not the database.
- Transactional read/writes in TypeScript.
- Directly read/write indexes including the ability to index graph/relational queries.
- Works with synchronous and asynchronous storage including SQLite or LevelDb.
- Suitable for frontend state management using in-memory synchronous storage.

**Table of Contents**
- [Quick Start](#Quick-Start)
- [Motivation](#Motivation)
- [Background](#Background)
- [Documentation](#Documentation)
- [Examples](#Examples)
- [Comparison with FoundationDb](#Comparison-with-FoundationDb)

# Quick Start

1. Install from NPM:

	```sh
	npm install tuple-database
	```

2. Define your schema.

	For example a contacts app in SQL might be defined as:

	```sql
	CREATE TABLE user (
		id UUID PRIMARY KEY,
		first_name TEXT,
		last_name TEXT,
		age INT
	)

	CREATE INDEX age ON user (age);
	CREATE INDEX name ON user (last_name, first_name);
	```

	But for this database, you would write:

	```ts
	type User = {id: string, first_name: string, last_name: string, age: number}

	type UserIndex = {
		key: ["user", {id: string}],
		value: User
	}

	type AgeIndex = {
		key: ["userByAge", {age: number}, {id: string}],
		value: null
	}

	type NameIndex = {
		key: ["userByName", {last_name: string}, {first_name string}, {id: string}],
		value: null
	}

	type Schema = UserIndex | AgeIndex | NameIndex
	```

3. Construct your database (see [Documenation](#Documentation) for more storage options).

	```ts
	import { TupleDatabaseClient, TupleDatabase, InMemoryTupleStorage } from "tuple-database"
	const db = new TupleDatabaseClient<Schema>(new TupleDatabase(new InMemoryTupleStorage()))
	```

4. Define read and write queries:

	```ts
	import { transactionalQuery } from "tuple-database"

	const removeUser = transactionalQuery<Schema>()((tx, id: string) => {
		const existing = tx.get(["user", {id}])
		if (!existing) return

		const {id, first_name, last_name, age} = existing
		tx.remove(["user", {id}])
		tx.remove(["userByAge", {age}, {id}])
		tx.remove(["userByName", {last_name}, {first_name}, {id}])
		return existing
	})

	const insertUser = transactionalQuery<Schema>()((tx, user: User) => {
		const {id, first_name, last_name, age} = user
		tx.set(["user", {id}], user)
		tx.set(["userByAge", {age}, {id}], null)
		tx.set(["userByName", {last_name}, {first_name}, {id}], null)
	})

	const upsertUser = transactionalQuery<Schema>()((tx, user: User) {
		removeUser(tx, user.id)
		insertUser(tx, user)
	})

	function getOldestUser(db: ReadOnlyTupleDatabaseClientApi<Schema>) {
			return db.scan({prefix: ["userByAge"], reverse: true, limit: 1})
				.map(({key, value}) => key)
				.map(namedTupleToObject)[0]
	}
	```

5. Use this database, for example, in your React application:

	```tsx
	import { useTupleDatabase } from "tuple-database/useTupleDatabase"

	function init({db}) {
		upsertUser(db, {id: "1", first_name: "Chet", last_name: "Corcos", age: 31})
		upsertUser(db, {id: "2", first_name: "Tanishq", last_name: "Kancharla", age: 22})
	}

	function App({db}) {
		const oldestUser = useTupleDatabase(db, getOldestUser, [])
		return <div>The oldest user is age: {oldestUser.age}</div>
	}
	```


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


# Background

The architecture of this database draws inspiration from a bunch of different places (although, primarily from FoundationDb). And it took a lot of reading only to find out that pretty much every database has similar abstractions under the hood -- an ordered list (or tree) of tuples and binary search. This is why DynamoDb and FoundationDb can have [frontend abstractions](https://apple.github.io/foundationdb/layer-concept.html) that are compatible with Postgres or [MongoDb](https://github.com/FoundationDB/fdb-document-layer).

Suppose we have the following SQL schema.

```sql
CREATE TABLE user (
	id UUID PRIMARY KEY,
	first_name TEXT,
	last_name TEXT,
	age INT
)

CREATE INDEX age ON user (age);
CREATE INDEX name ON user (last_name, first_name);
```

We've defined three different indexes here (including the primary key index). The name index has what is called a "composite key" -- that's a tuple right there!

With `tuple-database`, we'd represent this schema as follows (using TypeScript):

```ts
type User = {id: string, first_name: string, last_name: string, age: number}

type UserIndex = {
	key: ["user", {id: string}],
	value: User
}

type AgeIndex = {
	key: ["userByAge", {age: number}, {id: string}],
	value: null
}

type NameIndex = {
	key: ["userByName", {last_name: string}, {first_name string}, {id: string}],
	value: null
}

type Schema = UserIndex | AgeIndex | NameIndex
```

I said this database is *schemaless* and *it is schemaless* because the database does not enforce any kind of schema. But it's still useful to use types to define the kinds of things we *expect* in the database.

To create some users and write to the database, we simply create a transaction and manipulate the indexes ourselves.

```ts
import { TupleDatabaseClient, TupleDatabase, InMemoryTupleStorage } from "tuple-database"

const db = new TupleDatabaseClient<Schema>(new TupleDatabase(new InMemoryTupleStorage()))

function upsertUser(db: TupleDatabaseClient<Schema>, user: User) {
	const tx = db.transact()

	const existing = tx.get(["user", {id: user.id}])
	if (existing) {
		const {id, first_name, last_name, age} = existing
		tx.remove(["user", {id}])
		tx.remove(["userByAge", {age}, {id}])
		tx.remove(["userByName", {last_name}, {first_name}, {id}])
	}

	const {id, first_name, last_name, age} = user
	tx.set(["user", {id}], user)
	tx.set(["userByAge", {age}, {id}], null)
	tx.set(["userByName", {last_name}, {first_name}, {id}], null)

	tx.commit()
}

upsertUser(db, {id: "1", first_name: "Chet", last_name: "Corcos", age: 31})
upsertUser(db, {id: "2", first_name: "Tanishq", last_name: "Kancharla", age: 22})
```

Notice that we're transactionally reading and writing to the the database. And we can execute whatever kinds of code we want in this transaction -- we're not limited to some esoteric query syntax. And so while it might seem painful to manually write all of this code, you have the full expressive capabilities of TypeScript to compose functions together to make it all happen.

For example, here's a fairly straightforward refactor:

```ts
function removeUser(tx: TupleDatabaseTransaction<Schema>, id: string) {
	const existing = tx.get(["user", {id}])
	if (!existing) return

	const {id, first_name, last_name, age} = existing
	tx.remove(["user", {id}])
	tx.remove(["userByAge", {age}, {id}])
	tx.remove(["userByName", {last_name}, {first_name}, {id}])
	return existing
}

function insertUser(tx: TupleDatabaseTransaction<Schema>, user: User) {
	const {id, first_name, last_name, age} = user
	tx.set(["user", {id}], user)
	tx.set(["userByAge", {age}, {id}], null)
	tx.set(["userByName", {last_name}, {first_name}, {id}], null)
}

// Very expressive composition :)
function upsertUser(tx: TupleDatabaseTransaction<Schema>, user: User) {
	removeUser(tx, user.id)
	insertUser(tx, user)
}

// All in one transaction :)
const tx = db.transact()
upsertUser(tx, {id: "1", first_name: "Chet", last_name: "Corcos", age: 31})
upsertUser(tx, {id: "2", first_name: "Tanishq", last_name: "Kancharla", age: 22})
tx.commit()
```

So that's how you write to the database.

Now, how about querying the database? Suppose you want to lookup a user by last name:

```sql
SELECT id, first_name FROM user
WHERE last_name = $lastName
```

The query planner under the hood will use the name index and use binary search to jump to that last name and read out all the users with that given last name off of the index.

With `tuple-database` you do something very similar, except by directly reading the index:

```ts
function getUsersWithLastName(db: TupleDatabaseClient<Schema>, lastName: string) {
	return db.scan({prefix: ["userByName", {last_name: lastName}]})
		// => Array<{key: ["userByName", {last_name: string}, {first_name: string}, {id: string}], value: null}>
		.map(({key, value}) => key)
		// => Array<["userByName", {last_name: string}, {first_name: string}, {id: string}]>
		.map(namedTupleToObject)
		// => Array<{last_name: string, first_name: string, id: string}>
}
```

The important thing to realize here is that all we've done is dropped down to a lower level of abstraction. The logic we've written here for the `tuple-database` code is *exactly* what any SQL database is doing under the hood.

And now that you understand how databases fundamentally uses tuples under the hood, you can discover how this database can do much more than SQL by reading through the following examples:

- [Building a social app with indexed feeds.](./src/examples/socialApp.test.ts)
- [Building an end-user database with dynamic properties and indexing.](./src/examples/endUserDatabase.test.ts)

# Documentation

There are **three layers** to this database that you need to compose together.

## Terminology / Types

- A `Value` is any valid JSON.
- A `Tuple` is an array of `Value`s.
- A `key` is a `Tuple`.
- A `KeyValuePair` is `{key: Tuple, value: any}`.
	The `value` is `any` because in-memory storage doesn't have to serialize the value.

## TupleStorage

`TupleStorage` is the lowest level abstraction.

There's one method for reading and one method for writing.

- `write` for batch adding / removing key-value pairs:
	```ts
	write({
		set?: KeyValuePair[],
		remove?: Tuple[]
	}):  void
	```

- `scan` for reading a range of key-value pairs:
	```ts
	scan({
		gt?: Tuple, gte?: Tuple,
		lt?: Tuple, lte?: Tuple,
		reverse?: boolean,
		limit?: number
	}): KeyValuePair[]
	```

There are several different options for the storage layer.

1. InMemoryTupleStorage
	```ts
	import { InMemoryTupleStorage } from "tuple-database"
	const storage = new InMemoryTupleStorage()
	```
2. FileTupleStorage
	```ts
	import { FileTupleStorage } from "tuple-database/storage/FileTupleStorage"
	const storage = new FileTupleStorage(__dirname + "/app.db")
	```
3. LevelTupleStorage
	```ts
	import level from "level"
	import { LevelTupleStorage } from "tuple-database/storage/LevelTupleStorage"
	const storage = new LevelTupleStorage(level(__dirname + "/app.db"))
	```
4. SQLiteTupleStorage
	```ts
	import sqlite from "better-sqlite3"
	import { SQLiteTupleStorage } from "tuple-database/storage/SQLiteTupleStorage"
	const storage = new SQLiteTupleStorage(sqlite(__dirname + "/app.db"))

You can also create your own storage layer by implementing `TupleStorageApi` or `AsyncTupleStorageApi` interfaces.

```ts
import { TupleStorageApi } from "tuple-database"
class CustomTupleStorage implements TupleDatabaseApi {
	/* ... */
}
```

### Sort Order

Strings and numbers should be ordered as you might expect.

- `"a"` < `"b"`
- `"a"` < `"apple"`
- `2` < `10`

But since a `Value` is any valid JSON, we need to arbitrarily decide how to sort types. And we've arbitrarily decided that:

```ts
null < object < array < number < string < boolean
```

This every number is less than every string:
- `12` < `"apple"`

Arrays are "compound sorted", also called "composite keys". This is the same concept as "sort contacts by first *then* last name".
- `["adam"]` < `["adam", "smith"]`
- `["jon", "smith"]` < `["jonathan", "smith"]`

	This is an important case to understand because we aren't simply concatenating the strings (`"jonathansmith"` < `"jonsmith"`), instead we are comparing component-wise.

Objects are interpreted as ordered dictionaries -- an array of key-value pairs sorted by key.
- `{b: 2, a: 1} => [["a", 1], ["b", 2]]`

We have not discovered a particularly useful reason to use objects in the tuple key. Comparing objects like this just doesn't seem that valuable. We also arbitrarily chose to order objects as pairs rather than zipping (e.g. `{b: 2, a: 1} => [["a", "b"], [1, 2]]` ).

That said, we often use objects with a single key as a "named key" for developer convenience since the ordering will be the same. For example, a key might be `["favoriteColor", {person: string}, {color: string}]` which is less ambiguous than `["favoriteColor", string, string]` for developers to work with.

### Lexicographical Encoding

The tuple storage layer operates at the level of tuples and values. But most existing ordered key-value storage options will only accept bytes as keys. And its non-trivial to convert a tuple into a byte-string that maintains a consistent order. For example `2` < `11` but `"2"` > `"11"`.

For numbers, we use the [`elen` library](https://www.npmjs.com/package/elen) which encodes signed float64 numbers into strings.

For arrays, we join elements using a null byte `\x00` and escape null bytes with `\x00 => \x01\x00` as well as escaping the escape bytes `\x01 => \x01\x01`.

Lastly, we use a single byte to encode the type of the value which allows us to enforce the type order.

Please [read the source code](./src/helpers/codec.ts) for a better understanding of how this codec works. And check out the existing storage implementations to see how it is used.

### `MIN` / `MAX` Symbol For Prefix Scanning

One tricky thing about the scan API is how to you get all tuples with a given prefix? Given a tuple of `[firstName, lastName]`, how do you look up everyone with first name "Jon"?

- We can try something arbitrary like `scan({gt: ["Jon"], lte: ["Jon", "ZZZZ"]})`, but this will miss `["Jon", "ZZZZZZZZ"]`.
- We can increment the byte so the upper bound is `Jom`. But this is trickier when it comes to numbers. What if we want a prefix of `1`? Would the upper bound be `1.000000000000001`?

The solution I landed on was to introduce two special symbols.


	// TODO: spread these out more so we can migrate things easier.
	MIN: "a",
	null: "b",
	object: "c",
	array: "d",
	number: "e",
	string: "f",
	boolean: "g",
	MAX: "z",











	HERE







- `TupleDatabase` is the middle layer which implements reactivity and concurrency control.

	```ts
	import { TupleDatabase } from "tuple-database"
	const db = new TupleDatabase(storage)
	```

	If you're using the an async storage layer, you'll need to use `AsyncTupleDatabase`.


	```ts
	import { AsyncTupleDatabase } from "tuple-database"
	const db = new AsyncTupleDatabase(storage)
	```

- `TupleDatabaseClient` is the highest level layer that you will primarily be using to interact with the database.

	The client layer provides convenient methods and types on top of the TupleDatabase.

	```ts
	import { TupleDatabaseClient } from "tuple-database"
	const client = new TupleDatabaseClient(db)
	```

	If you're using async storage, then you need to use an async client. However you can also use the async client with synchronous storage.

	```ts
	import { AsyncTupleDatabaseClient } from "tuple-database"
	const client = new AsyncTupleDatabaseClient(db)
	```

**This documentation is incomplete.** Please read through the background and other examples above.

Documentation TODOs:
- `client.scan`
- `client.get`
- `client.exists`
- `client.transact`
- `client.subspace`
- `transactionalQuery`
- `subscribeQuery`
- `useTupleDatabase`

# Examples

- [Building a social app with indexes feeds.](./src/examples/socialApp.test.ts)
- [Building an end-user database with dynamic properties and indexing.](./src/examples/endUserDatabase.test.ts)

# Comparison with FoundationDb

This database works very similar to FoundationDb. In fact, I've created some abstractions modeled after their API. I've implemented the [class scheduling tutorial](https://apple.github.io/foundationdb/class-scheduling.html) from FoundationDb [as a test in this project](./src/test/classScheduling.test.ts).

However, there are some crucial differences with FoundationDb.

- This database is meant to be embedded, not a mutli-node cluster in the cloud.
- This database also has reactive queries, similar to Firebase.
- FoundationDb relies on the serialization process for running range queries. They do this by simply adding  `\0x00` and `0xff` bytes to the end of a serializied tuple prefix. This is really convenient, but it doesn't work for an in-memory database that does not serialize the data. Serialization for an in-memory database is just an unnecessary performance hit. That's why we have the `MIN` and `MAX` symbols.

# Development

One thing that's been pretty annoying is building async and sync storage abstractions in parallel. That's why `npm run build:macros` will compile async code into sync code for us.

## Brenchmark

We have a simple benchmark that read and writes a bunch. Mostly so we can compare between storage engines. This benchmark currenly does 11000 operations. 10000 reads and 1000 writes. So we're looking at fractions of a millisecond per operation.

```
AsyncTupleDatabase(InMemoryTupleStorage)):initialize 24.359458923339844
AsyncTupleDatabase(InMemoryTupleStorage)):readRemoveWrite 1289.2781257629395
AsyncTupleDatabase(SQLiteTupleStorage)):initialize 198.56974983215332
AsyncTupleDatabase(SQLiteTupleStorage)):readRemoveWrite 9325.776041984558
AsyncTupleDatabase(LevelTupleStorage)):initialize 61.02045822143555
AsyncTupleDatabase(LevelTupleStorage)):readRemoveWrite 2224.8067083358765
```

## How does Reactivity Work?

TODO:
- Spatial query
- Segment tree
- Interval tree
- Range tree
- Z-curve
- Binary space partitioning
- Calendar example

## How does Concurreny Control work?

TODO:
- ConcurrencyLog
- Read/write conflicts
- Retries with transactionalQuery
