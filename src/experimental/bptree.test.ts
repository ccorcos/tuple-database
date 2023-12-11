import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { BinaryPlusTree } from "./bptree"

type Key = string | number
type KeyTree =
	| { keys: Key[]; children?: undefined }
	| { keys: Key[]; children: KeyTree[] }

function toKeyTree(tree: BinaryPlusTree, id = "root"): KeyTree {
	const node = tree.nodes[id]
	if (!node) throw new Error("Missing node!")

	const keys = node.values.map((v) => v.key)
	if (node.leaf) return { keys: keys }

	const subtrees = node.values.map((v) => toKeyTree(tree, v.value))
	return { keys: keys, children: subtrees }
}

type TreeLayer = Key[][]

function toTreeLayers(tree: KeyTree): TreeLayer[] {
	const layers: TreeLayer[] = []

	let cursor = [tree]
	while (cursor.length > 0) {
		const layer: TreeLayer = []
		const nextCursor: KeyTree[] = []
		for (const tree of cursor) {
			layer.push(tree.keys)
			if (tree.children) nextCursor.push(...tree.children)
		}
		layers.push(layer)
		cursor = nextCursor
	}
	return layers
}

function print(x: any) {
	if (x === null) return "null"
	if (typeof x === "number") return x.toString()
	if (typeof x === "string") return JSON.stringify(x)
	if (Array.isArray(x)) return "[" + x.map(print).join(",") + "]"
	return ""
}

function inspect(tree: BinaryPlusTree) {
	const keyTree = toKeyTree(tree)
	const layers = toTreeLayers(keyTree)
	const str = layers
		.map((layer) =>
			layer.length === 1 ? print(layer[0]) : layer.map(print).join(" ")
		)
		.join("\n")
	return str
}

function parseTests(str: string) {
	// Cleanup extra whitespace
	str = str
		.split("\n")
		.map((line) => line.trim())
		.join("\n")
		.trim()

	return str.split("\n\n").map((block) => {
		const lines = block.split("\n")
		let comment = ""
		if (lines[0].startsWith("//")) {
			comment = lines[0].slice(3)
			lines.splice(0, 1)
		}
		const [op, nStr] = lines[0].split(" ")
		const n = parseInt(nStr)
		const tree = lines.slice(1).join("\n")
		return { comment, n, tree, op: op as "+" | "-" }
	})
}

const originalTests = `
+ 5
[5]

+ 10
[5,10]

+ 3
[3,5,10]

// First split
+ 6
[null,6]
[3,5] [6,10]

+ 14
[null,6]
[3,5] [6,10,14]

// Second split
+ 24
[null,6,14]
[3,5] [6,10] [14,24]

+ 20
[null,6,14]
[3,5] [6,10] [14,20,24]

// Double split
+ 22
[null,14]
[null,6] [14,22]
[3,5] [6,10] [14,20] [22,24]

+ 12
[null,14]
[null,6] [14,22]
[3,5] [6,10,12] [14,20] [22,24]

// Split
+ 11
[null,14]
[null,6,11] [14,22]
[3,5] [6,10] [11,12] [14,20] [22,24]

+ 2
[null,14]
[null,6,11] [14,22]
[2,3,5] [6,10] [11,12] [14,20] [22,24]

+ 13
[null,14]
[null,6,11] [14,22]
[2,3,5] [6,10] [11,12,13] [14,20] [22,24]
`

// Advisable that min <= max.
// Then we never have to "resplit".
// min = 2 // min >=2
// max = 4 // max >= min*2
const testsWithDelete = `
+ 5
[5]

+ 10
[5,10]

+ 3
[3,5,10]

// Delete from root leaf
- 5
[3,10]

+ 5
[3,5,10]

+ 7
[3,5,7,10]

// Split
+ 6
[null,7]
[3,5,6] [7,10]

// Merge right branch
- 7
[3,5,6,10]

+ 7
[null,7]
[3,5,6] [7,10]

- 6
[null,7]
[3,5] [7,10]

// Merge left branch
- 5
[3,7,10]

+ 5
[3,5,7,10]

+ 6
[null,7]
[3,5,6] [7,10]

+ 14
[null,7]
[3,5,6] [7,10,14]

+ 23
[null,7]
[3,5,6] [7,10,14,23]

+ 24
[null,7,23]
[3,5,6] [7,10,14] [23,24]

// Merge right branch
- 23
[null,7]
[3,5,6] [7,10,14,24]

+ 23
[null,7,23]
[3,5,6] [7,10,14] [23,24]

// Update parent minKey
- 7
[null,10,23]
[3,5,6] [10,14] [23,24]

// Merge middle branch
- 14
[null,23]
[3,5,6,10] [23,24]

+ 14
[null,10,23]
[3,5,6] [10,14] [23,24]

- 3
[null,10,23]
[5,6] [10,14] [23,24]

// Merge left branch
- 6
[null,23]
[5,10,14] [23,24]

+ 3
[null,23]
[3,5,10,14] [23,24]

+ 6
[null,10,23]
[3,5,6] [10,14] [23,24]

+ 7
[null,10,23]
[3,5,6,7] [10,14] [23,24]

+ 8
[null,7,10,23]
[3,5,6] [7,8] [10,14] [23,24]

+ 11
[null,7,10,23]
[3,5,6] [7,8] [10,11,14] [23,24]

+ 12
[null,7,10,23]
[3,5,6] [7,8] [10,11,12,14] [23,24]

// Double split
+ 13
[null,13]
[null,7,10] [13,23]
[3,5,6] [7,8] [10,11,12] [13,14] [23,24]

+ 15
[null,13]
[null,7,10] [13,23]
[3,5,6] [7,8] [10,11,12] [13,14,15] [23,24]

// Double update minKey
- 13
[null,14]
[null,7,10] [14,23]
[3,5,6] [7,8] [10,11,12] [14,15] [23,24]

// Double merge mid-right branch
- 14
[null,7,10,15]
[3,5,6] [7,8] [10,11,12] [15,23,24]

+ 2
[null,7,10,15]
[2,3,5,6] [7,8] [10,11,12] [15,23,24]

+ 4
[null,10]
[null,5,7] [10,15]
[2,3,4] [5,6] [7,8] [10,11,12] [15,23,24]

- 8
[null,10]
[null,5] [10,15]
[2,3,4] [5,6,7] [10,11,12] [15,23,24]

- 3
[null,10]
[null,5] [10,15]
[2,4] [5,6,7] [10,11,12] [15,23,24]

// Double merge left branch
- 2
[null,10,15]
[4,5,6,7] [10,11,12] [15,23,24]
`

describe("BinaryPlusTree", () => {
	it("inserts", () => {
		const tree = new BinaryPlusTree(2, 3)
		for (const test of parseTests(originalTests)) {
			if (test.op === "+") tree.set(test.n, test.n)
			if (test.op === "-") tree.delete(test.n)
			assert.equal(inspect(tree), test.tree, test.comment)
		}

		assert.equal(tree.depth(), 3)
	})

	// TODO: duplicate keys
	it("set and get", () => {
		const tree = new BinaryPlusTree(2, 3)
		const numbers: number[] = []
		for (let i = 0; i < 100; i++) numbers.push(Math.round(Math.random() * 1000))
		for (const n of numbers) tree.set(n, n)
		for (const n of numbers) assert.equal(tree.get(n), n)
		// console.log(inspect(tree))
	})

	it("big tree", function () {
		this.timeout(10_000)
		const tree = new BinaryPlusTree(2, 10)
		const numbers: number[] = []
		const size = 10_000
		for (let i = 0; i < size; i++)
			numbers.push(Math.round(Math.random() * size * 10))
		for (const n of numbers) tree.set(n, n)
		for (const n of numbers) assert.equal(tree.get(n), n)
		const expectedSize = Math.round(Math.log(size) / Math.log(10))
		assert.ok(tree.depth() - expectedSize <= 1)
	})

	it("tests with delete", () => {
		const tree = new BinaryPlusTree(2, 4)
		for (const test of parseTests(testsWithDelete)) {
			if (test.op === "+") tree.set(test.n, null)
			if (test.op === "-") tree.delete(test.n)
			assert.equal(inspect(tree), test.tree, test.comment)
		}
	})
})
