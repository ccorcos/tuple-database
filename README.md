# Tuple Database

This database stores tuples in component-wise lexicographical sorted order.

```ts
import sqlite from "better-sqlite3"
import { SQLiteStorage } from "tuple-database/storage/SQLiteStorage"

const people = [
	{ id: 1, first: "Chet", last: "Corcos", age: 29 },
	{ id: 2, first: "Simon", last: "Last", age: 26 },
	{ id: 3, first: "Jon", last: "Schwartz", age: 30 },
	{ id: 4, first: "Luke", last: "Hansen", age: 29 },
]

const sqliteStorage = new SQLiteStorage(sqlite("./app.db"))
const transaction = sqliteStorage.transact()
for (const person of people) {
	transaction.set("person", [person.age, person.last, person])
}
transaction.commit()

console.log(sqliteStorage.scan("person", { lt: [30] }))
// [
//   [ 26, 'Last', { id: 2, first: 'Simon', last: 'Last', age: 26 } ],
//   [ 29, 'Corcos', { id: 1, first: 'Chet', last: 'Corcos', age: 29 } ],
//   [ 29, 'Hansen', { id: 4, first: 'Luke', last: 'Hansen', age: 29 } ]
// ]
```

Queries are also reactive based on the index and any prefix for the `gt/lt` arguments.

```ts
import { ReactiveStorage, MIN, MAX } from "tuple-database"

const reactiveStorage = new ReactiveStorage(sqliteStorage)

const [results, unsubscribe] = reactiveStorage.subscribe(
	"person",
	{ gte: [30, MIN], lte: [30, MAX] }, // Alternatively, we could use { prefix: [30] }
	(updates) => {
		console.log("UPDATES", updates)
	}
)

console.log(results)
// [
//   [ 30, 'Schwartz', { id: 3, first: 'Jon', last: 'Schwartz', age: 30 } ]
// ]

// Update my age from 29 -> 30.
reactiveStorage
	.transact()
	.remove("person", [29, "Corcos", { id: 1, first: 'Chet', last: 'Corcos', age: 29 }])
	.set("person", [30, "Corcos", { id: 1, first: 'Chet', last: 'Corcos', age: 30 }])
	.commit()

// > UPDATES {
// 	person: {
// 		sets: [[30, "Corcos", { id: 1, first: "Chet", last: "Corcos", age: 30 }]],
// 		removes: [],
// 	},
// }

// Update Simon's age from 26 -> 27
reactiveStorage
	.transact()
	.remove("person", [26, 'Last', { id: 2, first: 'Simon', last: 'Last', age: 26 }])
	.set("person", [27, 'Last', { id: 2, first: 'Simon', last: 'Last', age: 27 }])
	.commit()

// Update doesn't log because it falls outside the query.
```

You can also add indexers to your `ReactiveStorage` to build up abstractions like a triple store.

```ts
const reactiveStorage = new ReactiveStorage(sqliteStorage, [
	(tx, op) => {
		if (op.index === "eav") {
			const [e, a, v] = op.tuple
			tx[op.type]("ave", [a, v, e])
			tx[op.type]("vea", [v, e, a])
			tx[op.type]("vae", [v, a, e])
		}
	}
])
```

## Why?

Databases are complicated. And as with most complicated things, you might find yourself battling the tool more than battling the problem you're trying to solve.

The goal of this project is to create a dead-simple database. It's just a binary tree index where you can store tuples that are component-wise sorted.

This database pushes all of the data modeling and indexing details down to you, the developer, so you get fine-grained control over read/write performance trade-offs.

Last but not least, this database is designed to be embedded in [local-first](https://www.inkandswitch.com/local-first.html) applications.

## Example

To run the example app, clone this repo, then:

```sh
npm install
npm run build
cd example
npm install
npm start
```

## TODO

- in-memory storage should accept any kind of object.



- I wish the indexing layers we more separable from ReactiveStorage, but I guess its fine...


- Can we make a Transaction feel more like a Storage middleware layer?
	// Flush every 2 seconds, or we can build up these changes and commit manually.
	const transaction = new Transaction(storage)
	setInterval(() => transaction.commit(), 2000)

- then we need to create runtime validators for type assertions.
- can we get rid of MIN/Max too?


- usability stuff
	- useSubscribe should have the same api as scan so they can be swapped out.
	- Might make sense for transaction to have the same apis as well? Prosemirror has state.tx which is interesting... Also tx.commit() might not make the most sense... though the fluent api is nice.

- Write an article explaining this project in more detail.
- Better reactivity performance?
	There might be a way to do this with a btree, but I think it might be necessary to build
	a proper hierarchical structure to make reactivity a more performant.
- Some kind of benchmark?
- better file format.

## Later

- custom storage
	- no serialization
	- custom sort directions
