## TODO

- minimal triplestore example
- benchmarks

- use reactive-magic strategy for composing queries more naturally.
	- get reactivity?

- typed subspace
	- maybe its better to use proxies around types?
	- how does firebase do this?

- README
	- notes about async database compilation.
	- new names and apis.


- how to use this in a UI with some kind of async backend.
	- how to cache in-process, or not?

- tuple database improvements
	- {key, value} object so that it isnt a valid tuple for the key.
		- Lets skip this for now... its gross when using write(), but we could fix that I suppose


- Game counter using this abstraction
	- other foundationdb examples.
		https://apple.github.io/foundationdb/data-modeling.html
	- Come up with a **good example** where we have to manually normalize data to motivate the triplestore.
	- ui architecture stuff
		- generic JSON abstractionc


### Later:
- proper abstraction for encoding/decoding objects, with `prototype.{compare, serialize, deserialize}`

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

