// - delete all the triplestore stuff and index updater stuff.
// - just storage and subscriptions for arbirary tuples.
// - proper encoding with relation and json options
// - sqlite storage, file storage, in-memory, and localstorage
// - move forward with building notebook app.

import { InMemoryStorage } from "./InMemoryStorage"
import { Index, ScanArgs } from "./storage"
import { randomId } from "../helpers/randomId"

const storage = new InMemoryStorage()

const docList: Index = {
	name: "doc-list",
	sort: [1, 1], // [orderKey, id]
}

// 64^5/2 appends before we have to worry about key growth.
const zero = "a0000"
const docId = randomId()

storage
	.transact()
	.set(docList, [zero, docId])
	.commit()

const blocks: Index = {
	name: "block",
	sort: [1, 1], // [id, blockJson]
}

// TODO: allow tuples and json here.
storage
	.transact()
	.set(blocks, [docId, JSON.stringify({ id: docId, type: "doc", content: [] })])
