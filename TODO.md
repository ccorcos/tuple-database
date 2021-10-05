
## TODO

- implement the class scheduling example...
	- https://apple.github.io/foundationdb/class-scheduling.html
	- subspace helper class. its pure!
	- subspace.range() returns a start and stop.
	- everything is stored as raw bytes making range queries a bit simpler.

- Subspace uses has tuple prefix and raw prefix https://github.com/apple/foundationdb/blob/dc3cebe8d904a704f734524943fc074dbaa59efc/bindings/python/fdb/subspace_impl.py
- Tuple range is just adds a null byte to the end. https://github.com/apple/foundationdb/blob/dc3cebe8d904a704f734524943fc074dbaa59efc/bindings/python/fdb/tuple.py#L442
	- This inherently relies on serialization to be querable. That's annoying.

TODO
- No more "index" shard thing. If we ever were to shard, we'd manually choose which tuples to split out anyways.



- https://apple.github.io/foundationdb/data-modeling.html


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