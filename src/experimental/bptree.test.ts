import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { BinaryPlusTree } from "./bptree"

function inspect(tree: BinaryPlusTree, id = "root") {
	const node = tree.nodes[id]
	if (!node) throw new Error("Missing node!")

	const layer = node.values.map((v) => v.key)
	if (node.leaf) return layer

	const subtrees = node.values.map((v) => inspect(tree, v.value))

	return [layer, subtrees]
}

describe("BinaryPlusTree", () => {
	it("inserts", () => {
		const tree = new BinaryPlusTree(2, 3)

		tree.set(5, null)
		console.log(inspect(tree))
		tree.set(10, null)
		console.log(inspect(tree))
		tree.set(3, null)
		console.log(inspect(tree))
		tree.set(6, null)
		console.log(inspect(tree))

		throw new Error("STOP")
		tree.set(14, null)
		console.log(inspect(tree))
		tree.set(24, null)
		console.log(inspect(tree))
		tree.set(20, null)
		console.log(inspect(tree))
		tree.set(22, null)
		console.log(inspect(tree))
		tree.set(12, null)
		console.log(inspect(tree))
		tree.set(11, null)
		console.log(inspect(tree))
		tree.set(2, null)
		console.log(inspect(tree))
		tree.set(13, null)
		console.log(inspect(tree))

		// Inserts -> [5, 10, 3, 6, 14, 24, 20, 22, 12, 11, 2, 13]

		// 5 -> [5]
		// 10 -> [5,10]
		// 3 -> [3,5,10]
		// 6 -> [3,5,6,10]
		// 	-> First split
		// 	-> [6]
		// 	[3,5] [6,10]
		// 14 -> [6]
		// 	[3,5] [6,10,14]
		// 24 -> [6]
		// 	[3,5] [6,10,14,24]
		// 	-> Second split
		// 	-> [6,14]
		// 	[3,5] [6,10] [14,24]
		// 20 -> [6,14]
		// 	[3,5] [6,10] [14,20,24]
		// 22 -> [6,14]
		// 	[3,5] [6,10] [14,20,22,24]
		// 	-> Third split
		// 	-> [6,14,22]
		// 	[3,5] [6,10] [14,20] [22,24]
		// 12 -> [6,14,22]
		// 	[3,5] [6,10,12] [14,20] [22,24]
		// 11 -> [6,14,22]
		// 	[3,5] [6,10,11,12] [14,20] [22,24]
		// 	-> Double split
		// 	-> [6,11,14,22]
		// 	[3,5] [6,10] [11,12] [14,20] [22,24]
		// 	-> [14]
		// 	  [6,11] [14,22]
		// 	[3,5] [6,10] [11,12] [14,20] [22,24]
		// 2 -> [14]
		// 	  [6,11] [14,22]
		// 	[2,3,5] [6,10] [11,12] [14,20] [22,24]
		// 13 -> Update parent minKey
		//    -> [14]
		// 	[6,11] [13,22]
		// [2,3,5] [6,10] [11,12] [13,14,20] [22,24]

		assert.ok(true)
	})
})
