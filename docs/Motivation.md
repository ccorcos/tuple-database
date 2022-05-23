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

// More about these 3 different layers later...
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

What's more is that you can subscribe for granular updates to this query as well!

```ts
const unsubscribe = db.subscribe({prefix: ["userByName", {last_name: "Corcos"}]}, (writes) => {
	console.log("Writes:", writes)
})

upsert({id: "1", first_name: "Chester", last_name: "Corcos", age: 31})
// > Writes: {
//     remove: [
//       ["userByName", {last_name: "Corcos"}, {first_name: "Chet"}, {id: "1"}]
//   	 ],
//     set: [{
//       key: ["userByName", {last_name: "Corcos"}, {first_name: "Chester"}, {id: "1"}]
//       value: null
//     }]
//   }
```

That said, it is inconvenient to interpret those writes into a new set of results so there's a convenient function called `subscribeQuery` that handles that for you:

```ts
const [initialResults, unsubscribe] = subscribeQuery(db, getUsersWithLastName, ["Corcos"], (newResults) => {
	// ...
})
```



## Demo 1: Indexing Many-to-many Relationships





















You can install this package from npm: `npm install tuple-database` and I highly recommend using TypeScript.

There are **three layers** to this database that you need to compose together.

- `TupleStorage` is the lowest level abstraction.

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














### What do I want you to learn?

- This is database stores ordered tuples. Heavily inspired by FoundationDb.
- There's a type schema in TypeScript.
- You can define mutations in this transaction thing.
- You can use this abstraction for simple things, like a game score counter.
- Or complex things like an end user database. Or a social app.


Benefits over others...
- transactional composition
- reactivity
- typescript types /schemas
- subspace composition.

### How does it work?

This is the video! How


"Talks are most engaging when working backwards from the problem"


