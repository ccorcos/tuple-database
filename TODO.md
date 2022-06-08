## TODO

What features do we need to make replicate easier?
- Writes -> WriteOps
- ScanArgs<> vs ScanArgs?
- tx.id and tx.writes so you can re-compose transactions.
- client.expose(subspace, indexer)

- using ipc-peer over a socket for client across a process / network.

- rtree for reactivity
- migration abstraction for MIN/MAX

- queue up commits to wait til after previous emits to prevent infinite loop issues. though also warn about it.
	Should we? This reduces concurrency performance advantage... Storage needs to handle concurrent writes?



- play with more triplestore ergonomics, order value, proxy objects.
	keep it simple for now though, no need to EXPLAIN or baked in indexes yet.

- types for ScanArgs with min/max for scanning..

- use reactive-magic strategy for composing queries more naturally.
	- get reactivity?

### Sometime Maybe
- Readable CSV FileStorage that isnt a cache.
- proper abstraction for encoding/decoding objects, with `prototype.{compare, serialize, deserialize}`
- compound sort directions?
