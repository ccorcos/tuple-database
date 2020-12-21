import * as _ from "lodash"
import * as assert from "assert"
import { scan, remove, set } from "./indexHelpers"
import { MAX, MIN, Tuple } from "./types"

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
const data: Array<Tuple> = []
for (const item of _.shuffle(items)) {
	set(data, item)
}
assert.deepEqual(data, items)

const result = scan(data, {
	gt: ["a", "a", MAX],
	lt: ["a", "c", MIN],
})

assert.deepEqual(result, [
	["a", "b", "a"],
	["a", "b", "b"],
	["a", "b", "c"],
])
