# Binary Tree Database

Just a reactive binary tree index.

```ts
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
const reactiveStorage = new ReactiveStorage(sqliteStorage)

const [results, unsubscribe] = reactiveStorage.subscribe(
	"person",
	{ gte: [30, MIN], lte: [30, MAX] },
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



## TODO

Goals:
- reactive embedded database
- scan arbitrary indexes

Next:
- build a todo mvc
- benchmark?

- sqlite storage, file storage, in-memory, and localstorage

# Explainer

- This database is just a glorified binary tree with component-wise tuple comparison.
- We encode all tuples into strings so we can throw everything in a single column in SQLite or use LevelDb, DynamoDb, etc.
