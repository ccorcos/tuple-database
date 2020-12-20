import { InMemoryStorage } from "./InMemoryStorage"
import { Index, ScanArgs } from "./types"
import { randomId } from "../helpers/randomId"
import * as json from "../helpers/json"

const storage = new InMemoryStorage()

const docList: Index = {
	name: "doc-list",
	sort: [1, 1], // [orderKey, id]
}

// 64^5/2 appends before we have to worry about key growth.
const zero = "a0000"
const docId = randomId()

storage.transact().set(docList, [zero, docId]).commit()

const blocks: Index = {
	name: "block",
	sort: [1, 1], // [id, blockJson]
}

// TODO: allow tuples and json here.
storage
	.transact()
	.set(blocks, [docId, json.stringify({ id: docId, type: "doc", content: [] })])
	.commit()

// subscribe(storage, {gt: ...})

// TODO:
// start from scratch again
// use prefix explicitly for queries.
