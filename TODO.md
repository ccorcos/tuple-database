## TODO

- [x] get rid of typed schema.
- [ ] add a write-op to check a versionstamp.
- [ ] scan needs to return a versionstamp.
- [ ] fix the concurrency control.
- [ ] build a filing cabinet abstraction...
- [ ] build a whole table + indexing database idea.

- denokv abstraction to explicitly check your reads.
- maybe all these types are making this library too complicated.
- can I use foundationdb as a backend?
- how can I scale up reactivity?s


https://deno.land/manual/runtime/kv
```ts
const kv = await Deno.openKv();
const result = await kv.set(["preferences", "ada"], prefs);

const kv = await Deno.openKv();
const result = await kv.getMany([
  ["preferences", "ada"],
  ["preferences", "grace"],
]);
result[0].key; // ["preferences", "ada"]
result[0].value; // { ... }
result[0].versionstamp; // "00000000000000010000"
result[1].key; // ["preferences", "grace"]
result[1].value; // null
result[1].versionstamp; // null

const entries = kv.list({ prefix: ["preferences"] });
for await (const entry of entries) {
  console.log(entry.key); // ["preferences", "ada"]
  console.log(entry.value); // { ... }
  console.log(entry.versionstamp); // "00000000000000010000"
}

await kv.delete(["preferences", "alan"]);

const res = await kv.atomic()
  .check({ key, versionstamp: null }) // `null` versionstamps mean 'no value'
  .set(key, value)
  .commit();
if (res.ok) {
  console.log("Preferences did not yet exist. Inserted!");
} else {
  console.error("Preferences already exist.");
}

const iter = kv.list<string>({ prefix: ["users"] }, { limit: 2 });
const iter = kv.list<string>({ prefix: ["users"], start: ["users", "taylor"] });
const iter = kv.list<string>({ start: ["users", "a"], end: ["users", "n"] });
;{reverse: true}


await kv.atomic()
  .mutate({
    type: "sum",
    key: ["accounts", "alex"],
    value: new Deno.KvU64(100n),
  })
  .commit();

await kv.atomic()
  .mutate({
    type: "min",
    key: ["accounts", "alex"],
    value: new Deno.KvU64(100n),
  })
  .commit();



```






- listen vs subscribe. transactional. makes things much simpler over here.


- types... need to constraint key-value args. value cna be wrong.
- types... should be able to pass a string literal to a string and it should match for prefix extension stuff.


- client.expose(subspace, indexer)

- keep track of transactions and expire them after a timeout
- keep track of committed transactions too and expire after timeout?

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
