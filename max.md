component-wise lexicographical order.


lexicographical order:

a
b
c
Charlie
Chet
Chetter
d

1
10
11
2
3
4
...
9

To make numbers lexicographically sortable:

- zero-pad encoding

00001
00002
00003
00004
...
00009
00010
00011

- zero-pad with zero-padded exponent encoding (scientific notation)


component-wise:

[Che, tA]
[Che, tB]
[Chet, A]
[Chet, B]

ChetA
ChetA
ChetB
ChetB



## Filing cabinet analogy

```ts
const officer = {
	id: "234329"
	location: "NYC",
	name: "Chet Corcos"
}
```

- Who is the officer with batch X?
	- [id]
- Who is the officer with name X?
	- [name]
- Who is the officer with last name Smith from NYC?
	- cabinet sorted by last name
	- cabinet sorted by location
	- sorted by [location, last name]

3 different filing cabinets to answer these questions quickly.


Who is the officer with name X?
- sort by name, i have the entire officer file in there.
	change anything about the officer and i need photocopy the entire file and add it here.
- sort by name, I just have the badge id -> take the badge id and lookup in another filing cabinet.
	change anything about the officer, don't need to update the name cabinet, but two reads.


read/write trade-off.



SQL Query planner:
- Who is the officer with last name Smith from NYC?
	- cabinet sorted by last name
	- cabinet sorted by location

applications -> same question millions of times
business intelligations -> 1 million different questions


MAX gets it here. I have power to do reads and writes.

Whats cool about my database?
- dynamic data (notion collection example). "schemaless" database.
- you can use filing cabinets for reactive updates.

- updates without scanning through everyone whos listening
	joe -> NYC
	Max -> Sacramento
	Charlie -> last name Smith

	rather than iterate through every listener, I just look for the specific people who need the update.

- other databses don't do this?

	SQL ->
	CREATE INDEX ON <table> location (location)
	CREATE INDEX ON <table> name (name)
	CREATE INDEX ON <table> location_name (location, name)

	In SQL: every update to an officer is going to check if needs to update any of these indexes.
	update to different table doesnt need to check these indexes to update.

	SQL doesnt have reactivity for developers.
	Firestore, RethinkDb sort of did this, but not efficiently -> O(n) in the number listeners.

<!--

reactive storage:

- I want to know whenever a change is made to an officer in NYC.
	- in an application, maybe I have alist of all officers in NYC.
	- 100s people who to be updates for differenty locations.

	- "location", [location, officer]
	- "location-updates", [location, person]
	- whenever I write to "location" -> lookup in "location-updates" who do I send updates to.


1. We can use filing cabinets to proactively notify when specific things change. -->

What's next level about reactivity:
- create dynamic rules.


```ts
db.set("friend", ["chet", "max"])
db.set("friend", ["chet", "andrew"])
db.scan("friend", {prefix: "chet"}).map(tuple => tuple[tuple.length - 1])
// ["andrew", "max"]

db.scan("friend", {prefix: "max"}).map(tuple => tuple[tuple.length - 1])
// []

// If I want this to a <-> relationship, I can "make a rule".
db.subscribe("friend", {}, ([friend1, friend2]) => {
	db.set("friend", [friend2, friend1])
})

db.set("friend", ["chet", "andrew"])
// Implies also: db.set("friend", ["andrew", "chet"])
```

Back to the Notion collection example.
Persist the rules to the database.

Next-level powerful:
- examples of things that are hard without this.
- make it a bit more tangible.