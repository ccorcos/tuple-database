# Binary Tree Database

Just a reactive binary tree index.


## TODO

Goals:
- reactive embedded database
- scan arbitrary indexes

Next:
- reactivity!
- client/server
- build a todo mvc
- benchmark?


- sqlite storage, file storage, in-memory, and localstorage

# Explainer

- This database is just a glorified binary tree with component-wise tuple comparison.
- We encode all tuples into strings so we can throw everything in a single column in SQLite or use LevelDb, DynamoDb, etc.
