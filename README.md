# Tuple Database

This database stores tuples in component-wise lexicographical sorted order.

```ts
import { SQLiteStorage } from "tuple-database/storage/SQLiteStorage"

const people = [
	{ id: 1, first: "Chet", last: "Corcos", age: 29 },
	{ id: 2, first: "Simon", last: "Last", age: 26 },
	{ id: 3, first: "Jon", last: "Schwartz", age: 30 },
	{ id: 4, first: "Luke", last: "Hansen", age: 29 },
]

const sqliteStorage = new SQLiteStorage("./app.db")
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

- rename to tuple-database
	- Public package to npm.
- Write an article explaining this project in more detail.
- Better reactivity performance?
	There might be a way to do this with a btree, but I think it might be necessary to build
	a proper hierarchical structure to make reactivity a more performant.
- Some kind of benchmark?
