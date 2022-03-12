# Tuple Database

This database stores tuples in component-wise lexicographical sorted order.

It is an ordered key-value database with some encoding facilities for storing numbers, booleans, and ordered dictionaries.

This database works very similar to FoundationDb. In fact, I've created some abstractions modeled after their api. I've implemented the [class scheduling tutorial](https://apple.github.io/foundationdb/class-scheduling.html) from FoundationDb [as a test in this project](./src/test/classScheduling.test.ts).


## API by example

Creating a SQLite-backed database, writing and querying.

```ts
import sqlite from "better-sqlite3"
import {TupleDatabase} from "tuple-database"
import { SQLiteTupleStorage } from "tuple-database/storage/SQLiteTupleStorage"

const db = new TupleDatabase(
	new SQLiteTupleStorage(sqlite("./app.db"))
)

const people = [
	{ id: 1, first: "Chet", last: "Corcos", age: 29 },
	{ id: 2, first: "Simon", last: "Last", age: 26 },
	{ id: 3, first: "Jon", last: "Schwartz", age: 30 },
	{ id: 4, first: "Luke", last: "Hansen", age: 29 },
]

const tx = db.transact()
for (const person of people) {
	// Putting the id in there to make sure this tuple "key" is unique.
	tx.set(["personByAge", person.age, person.id], person)
}
tx.commit()

console.log(db.scan({ prefix: ["personByAge"], lt: [30] }))
// [
//   [[ 26, 2 ], { id: 2, first: 'Simon', last: 'Last', age: 26 } ],
//   [[ 29, 1 ], { id: 1, first: 'Chet', last: 'Corcos', age: 29 } ],
//   [[ 29, 4 ], { id: 4, fsirst: 'Luke', last: 'Hansen', age: 29 } ]
// ]
```

We can create multiple indexes of the same data so we can query things conveniently.

```ts
const tx = db.transact()
for (const person of people) {
	// Putting the id in there to make sure this tuple "key" is unique.
	tx.set(["personById", person.id], person)
	tx.set(["personByLastFirst", person.last, person.first, person.id], person)
	tx.set(["personByFirstLast", person.first, person.last, person.id], person)
	tx.set(["personByAge", person.age, person.id], person)
}
tx.commit()
```

We also have read-write transactional guarantees:

```ts
const tx1 = db.transact()
const score = tx1.get(["score"])
tx1.set(["score"], score + 1)

const tx2 = db.transact()
tx2.set(["score"], 10)
tx2.commit()

tx1.commit() // Throws an error.
```

There are also some nice abstractions inspired by FoundationDb such as `Subspace` and `transactional`.

When dealing with a big application with logs of data, its helpful to use a Subspace to manage tuple prefixes.

```ts
import { Subspace } from "tuple-database"

const contacts = new Subspace("contacts")
const byAge = contacts.subspace("byAge")

contacts.pack([1]) // ["contacts", 1]
contacts.unpack(["contacts", 1]) // [1]

byAge.pack([29, 1]) // ["contacts", "byAge", 29, 1]
byAge.unpack(["contacts", "byAge", 29, 1]) // [29, 1]
```

So we might use this for contructing an entire application data model and use them to pack and unpack tuples.

```ts
db.transact()
	.set(contacts.pack([person.id]), person)
	.set(byAge.pack([person.age, person.id]), person)
	.commit()

// Use range for prefix queries into the subspace.
byAge.range([29])
// => {gte: ["contacts", "byAge", 29, MIN], lte: ["contacts", "byAge", 29, MAX]}

// Unpack the tuples to remove the prefix.
db.scan(byAge.range([29])).map(([tuple, value]) => byAge.unpack(tuple))
// => [[29, 1], [29, 4]]
```

There's also a nice helper function for composing writes to the database.

```ts
import { transactional } from "tuple-database"

const setPersonById = transactional((tx, person) => {
	tx.set(byAge.pack([person.id]), person)
})

const setPersonByAge = transactional((tx, person) => {
	tx.set(byAge.pack([person.age, person.id]), person)
})

const setPerson = transactional((tx, person) => {
	setPersonById(tx, person)
	setPersonByAge(tx, person)
})

// When you call a transactional function with a transaction, the transaction will not be committed,
// but when you call with a database, it will create and commit the transaction. This allows you to
// compose writes together.

setPerson(db, { id: 1, first: 'Chet', last: 'Corcos', age: 29 })
```

Last but not least, queries are also reactive based on the prefix for the `gt/lt` arguments.

```ts
import { ReactiveStorage, MIN, MAX } from "tuple-database"

db = new ReactiveStorage(db)

const unsubscribe = db.subscribe(
	byAge.range([30]),
	(updates) => {
		console.log("UPDATES", updates)
	}
)

console.log(db.scan(byAge.range([30])))
// [
//   [ 30, 'Schwartz', { id: 3, first: 'Jon', last: 'Schwartz', age: 30 } ]
// ]

// Update my age from 29 -> 30.
updatePerson({ id: 1, first: 'Chet', last: 'Corcos', age: 30 })

// > UPDATES {
// 	person: {
// 		sets: [[["contacts", "byAge", 30, 1], { id: 1, first: "Chet", last: "Corcos", age: 30 }]],
// 		removes: [],
// 	},
// }

// Update Simon's age from 26 -> 27
updatePerson({ id: 2, first: 'Simon', last: 'Last', age: 27 })

// Update doesn't log because it falls outside the query.
```

For more interesting tips about data modeling using this library read this: https://apple.github.io/foundationdb/data-modeling.html

## Comparison with FoundationDb

- This database is meant to be embedded, not multi-tenant hosted in the cloud. There is no support for concurrent writes at the moment, though it could later on.
- This database also has reactive queries, similar to Firebase.
- This database also has indexing hooks so you can manage your own indexes.
- FoundationDb relies on the serialization process for running range queries. They do this by simply adding  `\0x00` and `0xff` bytes to the end of a serializied tuple prefix. This is really convenient, but it doesn't work for an in-memory database that does not serialize the data. Serialization for an in-memory database is just an unnecessary performance hit. That's why we have the `MIN` and `MAX` symbols.

## Why?

Databases are complicated. And as with most complicated things, you might find yourself battling the tool more than battling the problem you're trying to solve.

The goal of this project is to create a dead-simple database. It's just a binary tree index where you can store tuples that are component-wise sorted.

This database pushes all of the data modeling and indexing details down to you, the developer, so you get fine-grained control over read/write performance trade-offs.

Last but not least, this database is designed to be embedded in [local-first](https://www.inkandswitch.com/local-first.html) applications.


## Development

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
