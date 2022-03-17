
- Architecture README
	- TupleStorage
	- TupleDatabase
	- TupleDatabaseClient
	- transactionalQuery
	- subspace


# Tuple Database

Some features of this database:

- ordered key-value store with JSON tuples as keys.
- reactivity for all queries.
- transactional reads and writes (aka multi-version concurrency control).
- build with TypeScript and works in Node.js or the Browser.
- works with synchronous and asynchronous storage making it well-suited for frontend state management.
- a simple storage interface and with existing adapters for SQLite and LevelDb.


# Documentation

## Quick Start (by Example)

```sh
npm install --save tuple-database
```

```ts
import {
	InMemoryTupleStorage,
	TupleDatabase,
	TupleDatabaseClient,
	transactionalQuery
} from "tuple-database"

type Person = { id: string; name: string; age: number }

// First element is the key, second element is the value.
type Schema =
	| [["person", string], Person]
	| [["personByName", string, string], Person]
	| [["personByAge", number, string], Person]

const db = new TupleDatabaseClient<Schema>(
		new TupleDatabase(new InMemoryTupleStorage())
)

// Remove a person from the database.
const removePerson = transactionalQuery<Schema>()(
	(tx, id: string) => {
		const person = tx.get(["person", id])
		if (person) {
			tx.remove(["person", existing.id])
			tx.remove(["personByName", existing.name, existing.id])
			tx.remove(["personByAge", existing.age, existing.id])
		}
	}
)

// Write a person to the database.
const writePerson = transactionalQuery<Schema>()(
	(tx, person: Person) => {
		removePerson(tx, person.id) // (these transactions compose together ;)
		tx.set(["person", person.id], person)
		tx.set(["personByName", person.name, person.id], person)
		tx.set(["personByAge", person.age, person.id], person)
	}
)

writePerson(db, { id: "1", name: "Chet", age: 31 })
writePerson(db, { id: "2", name: "Meghan", age: 30 })
writePerson(db, { id: "3", name: "Tanishq", age: 22 })

const personByAge = db.subspace(["personByAge"])
personByAge.scan().map(([tuple, value]) => value)
// => [
//   { id: "3", name: "Tanishq", age: 22 }
//   { id: "2", name: "Meghan", age: 30 }
//   { id: "1", name: "Chet", age: 31 }
// ]

personByAge.scan({gte: [30]}).map(([tuple, value]) => value)
// => [
//   { id: "2", name: "Meghan", age: 30 }
//   { id: "1", name: "Chet", age: 31 }
// ]

personByAge.scan({reverse: true, limit: 1}).map(([tuple, value]) => value)
// => [
//   { id: "1", name: "Chet", age: 31 }
// ]

const personById = db.subspace(["person"])
personById.get(["2"])
// => { id: "2", name: "Meghan", age: 30 }


// Reactivity as well.
const personByName = db.subspace(["personByName"])
const unsubscribe = personByName.subscribe({prefix: ["Tanishq"]}}, (writes) => {
	console.log("Writes:", writes)
})
writePerson(db, { id: "3", name: "Tanishq", age: 23 })
// > Writes: {set: [[["personByName", "Tanishq", "3"], { id: "3", name: "Tanishq", age: 23 }]]}

removePerson(db, "3")
// > Writes: {remove: [["personByName", "Tanishq", "3"]]}
```

## Architecture

At the lowest level, we have storage layers that are the backend for this database.

Storage layers must implement the `TupleStorageApi` or `AsyncTupleStorageApi`.

These are the existing storage layers, but there's no reason you couldn't build one for just about any database.

```ts
// Synchronous Storage
import { InMemoryTupleStorage } from "tuple-database"
import { FileTupleStorage } from "tuple-database/storage/FileTupleStorage"
import { SQLiteTupleStorage } from "tuple-database/storage/SQLiteTupleStorage"
// Asynchronous Storage
import { LevelTupleStorage } from "tuple-database/storage/LevelTupleStorage"
```

The next level up is the database layer. `TupleDatabase` and `AsyncTupleDatabase` accept a storage layer and implement reactivity and multi-version concurrency control (MVCC). This is the "embedded" database in the sense that it is necessary that all reads and writes into storage go through this database in order to keep track of concurrency issues and reactivity.

The highest level layer is the `TupleDatabaseClient` and `AsyncTupleDatabaseClient`. These layers implement some convenient syntax (`get(tuple)`, `exists(tuple)`, `transact()`, `subspace(prefix)`) as well as TypeScript typed schemas. This is the layer you will almost always be working with. When you construct a client, it accepts a `TupleDatabaseApi` (or `AsyncTupleDatabaseApi`) rather than the actual class which allows you to implement this API across process boundaries. For example, you might have the `AsyncTupleDatabase` in the main process of an Electron app with a `AsyncTupleDatabaseClient` in each of your renderer processes communicating over IPC bridge that implements `AsyncTupleDatabaseApi`.

# Motivation

Databases are complicated. And as with most complicated things, you might find yourself battling the tool more than battling the problem you're trying to solve.

The goal of this project is to create a dead-simple database. It's just a binary tree index where you can store tuples that are component-wise sorted. In fact, you might notice that there are some striking similarities with FoundationDb or Firebase.

This database pushes all of the data modeling and indexing details down to you, the developer, so you get fine-grained control over read/write performance trade-offs.

**Last but not least**, this database is primarily designed to be embedded in [Local-first](https://www.inkandswitch.com/local-first.html) applications and solve some acute pain points:

1. You can transactionally read/write to this database from a different process through a simple API. This is important because your rendering will likely happen in a separate process. However, queries are fast because they're local so there isn't a need for a complex optimistic cache.

2. All queries are reactive which makes it much easier for building user interfaces. SQLite is the current gold-standard for storage in Local-first applications, but leaves this fairly non-trivial feature to be desired.

**And one more thing**, this database has been designed so that it can as a state management layer for frontend applications! Once you have a sufficiently complex application, you'll find yourself normalizing and denormalizing data, creating and caching indexes, and creating a complex reactivity system to power it all. This is what databases are designed to do and it's about time we get accustomed to using databases in our frontend applications.

One crucial piece that enabled this to work well for frontend state management is that there is a synchronous database api option that works with in-memory storage (as well as asynchronous for durable or remote storage). In frontend applications in the browser, it's *very important* that your state updates can happen in the same synchronous callback from a user event because browsers often require that some actions must happen synchronously in response to a user action (for example opening up a link in a new tab). With an asynchronous state management layer, you will be constantly battling these kinds of UX / abstraction issues.

## Comparison with FoundationDb

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
