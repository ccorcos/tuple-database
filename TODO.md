## Next Readme

This database works very similar to FoundationDb.

Thus, we're using some familiar abstractions.
- [Subspace](https://github.com/apple/foundationdb/blob/dc3cebe8d904a704f734524943fc074dbaa59efc/bindings/python/fdb/subspace_impl.py) for handling tuple prefixes.
- And transactional for composing writes together.

Some notable differences:
- This API does not support async concurrent writes, though it could later on, leveraging similar transaction retry logic.
- The in-memory storage system does not serialize, so we need `MIN` and `MAX` symbols to do prefix queries rather than being able to simply add `\0x00` and `0xff` bytes to the end of a serializied tuple.


I've implemented the [class scheduling tutorial](https://apple.github.io/foundationdb/class-scheduling.html) from FoundationDb as a test in this project, demonstrating a similar API.


Some more interesting tips about using this library here: https://apple.github.io/foundationdb/data-modeling.html


## TODO

- get reactive storage working again.
	- use reactive-magic strategy for composing queries more naturally.

- Game counter using this abstraction
	- other foundationdb examples.
		https://apple.github.io/foundationdb/data-modeling.html
	- Come up with a **good example** where we have to manually normalize data to motivate the triplestore.
	- ui architecture stuff
		- generic JSON abstractionc



### Later:
- can we make a faster encoding using `buf.writeDoubleBE()`?
- spread out the tuple encoding so we can migrate later

---




- triplestore

- react bindings for reactive storage... same api as scan ideally.
- better types / runtime validators?

- read the rest of the developer guide: https://apple.github.io/foundationdb/developer-guide.html

- Game Counter can definitely use this abstraction.
	- writes need to be normalized manually still, though maybe its not as gnarly.
	- triplestore is really the goal though...
	- use this for the html editor app state.
		- edit file name / move file around.
		-

---

What's up with the Triplestore then?
- it's just an algebraic way of describing objects so that the database can handle indexing automatically.

---

- I wish the indexing layers we more separable from ReactiveStorage, but I guess its fine...

- Some kind of performance benchmark

- Custom sort directions.
	- We can get away with reversing the scan direction.
	- But for complex apps (like Notion activities), we'll need compound sorting.

- Better raw file format that feels more readable / accessible?

