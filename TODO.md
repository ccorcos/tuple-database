## Next Readme

This database works very similar to FoundationDb.

Thus, we're using some familiar abstractions.
- [Subspace](https://github.com/apple/foundationdb/blob/dc3cebe8d904a704f734524943fc074dbaa59efc/bindings/python/fdb/subspace_impl.py) for handling tuple prefixes.
- And transactional for composing writes together.

Some notable differences:
- This API does not support async concurrent writes, though it could later on, leveraging similar transaction retry logic.
- The in-memory storage system does not serialize, so we need `MIN` and `MAX` symbols to do prefix queries rather than being able to simply add `\0x00` and `0xff` bytes to the end of a serializied tuple.


I've implemented the [class scheduling tutorial](https://apple.github.io/foundationdb/class-scheduling.html) from FoundationDb as a test in this project, demonstrating a similar API.




## TODO

- classScheduling test.


- https://apple.github.io/foundationdb/data-modeling.html


- I wish the indexing layers we more separable from ReactiveStorage, but I guess its fine...

- then we need to create runtime validators for type assertions.


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