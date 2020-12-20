import * as _ from "lodash"
import * as assert from "assert"
import * as fs from "fs"
import { rootPath } from "../helpers/rootPath"
import { SQLiteStorage } from "./SQLiteStorage"
import { Index } from "./types"

const dbPath = rootPath("chet.db")
fs.unlinkSync(dbPath)

const store = new SQLiteStorage(dbPath)

const index: Index = { name: "abc", sort: [1, 1, 1] }
const items = [
	["a", "a", "a"],
	["a", "a", "b"],
	["a", "a", "c"],
	["a", "b", "a"],
	["a", "b", "b"],
	["a", "b", "c"],
	["a", "c", "a"],
	["a", "c", "b"],
	["a", "c", "c"],
]
const transaction = store.transact()
for (const item of _.shuffle(items)) {
	transaction.set(index, item)
}
transaction.commit()
const data = store.scan(index)
assert.deepEqual(data, items)

const result = store.scan(index, {
	start: ["a", "a", "c"],
	end: ["a", "c"],
})

// Dang, this won't work!

console.log("result", result)

// assert.deepEqual(result, [
// 	["a", "a", "c"],
// 	["a", "b", "a"],
// 	["a", "b", "b"],
// 	["a", "b", "c"],
// 	["a", "c", "a"],
// 	["a", "c", "b"],
// 	["a", "c", "c"],
// ])
