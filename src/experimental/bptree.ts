/*

Both Postgres and SQLite use B+ trees as the foundation of their indexes.

Even though we have an OrderedKeyValueDatabase, let's build a B+ tree on top of a KeyValueDatabase
so that we can later extend it to an interval tree and a range tree.

TODO:
- delete keys and compact.
- add plenty more comments.
- what to do about duplicate keys.
- some basic performance analysis and comparison.
-> interval tree!

LATER:
- batch insert.
-

*/

type Key = string | number

export type BranchNode = {
	leaf?: false
	id: string
	// nodes: { minKey: Key; id: string }[]
	values: { key: Key | null; value: string }[]
}

export type LeafNode = {
	leaf: true
	id: string
	values: { key: Key | null; value: any }[]
}

export class BinaryPlusTree {
	nodes: { [key: Key]: BranchNode | LeafNode | undefined } = {}

	constructor(private minSize: number, private maxSize: number) {}

	get = (key: Key): any | undefined => {
		const root = this.nodes["root"]
		if (!root) return

		let node = root
		while (true) {
			if (node.leaf) {
				const result = binarySearch(node.values, (x) => compare(x.key, key))
				if (result.found === undefined) return
				return node.values[result.found].value
			}

			const result = binarySearch(node.values, (x) => compare(x.key, key))
			if (result.found !== undefined) {
				const childId = node.values[result.found].value
				const child = this.nodes[childId]
				if (!child) throw Error("Missing child node.")
				node = child
				continue
			}

			// Closest node that is greater than the key.
			// Left-most node key is always null so closest should never be 0.
			if (result.closest === 0) throw new Error("Broken.")
			const childId = node.values[result.closest - 1].value
			const child = this.nodes[childId]
			if (!child) throw Error("Missing child node.")
			node = child
		}
	}

	set = (key: Key, value: any) => {
		const root = this.nodes["root"]

		// Intitalize root node.
		if (!root) {
			this.nodes["root"] = {
				leaf: true,
				id: "root",
				values: [{ key, value }],
			}
			return
		}

		// Insert into leaf node.
		const nodePath = [root]
		const indexPath: number[] = []
		while (true) {
			const node = nodePath[0]

			if (node.leaf) {
				insert({ key, value }, node.values, (x) => compare(x.key, key))
				break
			}

			const result = binarySearch(node.values, (x) => compare(x.key, key))
			const index =
				result.found !== undefined ? result.found : result.closest - 1
			const childId = node.values[index].value
			const child = this.nodes[childId]
			if (!child) throw Error("Missing child node.")
			nodePath.unshift(child)
			indexPath.unshift(index)
		}

		// Balance the tree, starting from the leaf.
		let node = nodePath.shift()
		while (node) {
			const size = node.values.length
			if (size <= this.maxSize) break

			const splitIndex = Math.round(size / 2)
			const rightNode: LeafNode | BranchNode = {
				id: randomId(),
				leaf: node.leaf,
				values: node.values.splice(splitIndex),
			}
			this.nodes[rightNode.id] = rightNode
			const rightMinKey = rightNode.values[0].key

			// If we're splitting the root node.
			if (node.id === "root") {
				const leftNode: LeafNode | BranchNode = {
					id: randomId(),
					leaf: node.leaf,
					values: node.values,
				}
				this.nodes[leftNode.id] = leftNode

				this.nodes["root"] = {
					id: "root",
					values: [
						{ key: null, value: leftNode.id },
						{ key: rightMinKey, value: rightNode.id },
					],
				}
				break
			}

			// Insert right node into parent.
			const parent = nodePath.shift()
			const parentIndex = indexPath.shift()
			if (!parent) throw new Error("Broken.")
			if (parentIndex === undefined) throw new Error("Broken.")
			parent.values.splice(parentIndex + 1, 0, {
				key: rightMinKey,
				value: rightNode.id,
			})

			// Recur
			node = parent
		}
	}

	// If its too small, then merge with left or right.
	// NOPE: If its too big, then re-split.
	// Remove from parent values
	// If the parent only has one item, then delete the parent

	private merge(nodePath: (BranchNode | LeafNode)[], indexPath: number[]) {
		// [null,6]
		// [3,5] [6,10]
		// 6 -
		// [3,5,10]

		// [null,14]
		// [null,6] [14,22]
		// [3,5] [6,10] [14,20] [22,24]
		// 6 -
		// [null,14,22]
		// [3,5,10] [14,20] [22,24]

		let child = nodePath.shift()!

		while (child.values.length < this.minSize) {
			if (child.id === "root") {
				if (child.leaf) return
			}

			const parentIndex = indexPath.shift()
			const parent = nodePath.shift()
			if (!parent) throw new Error("Broken.")
			if (parentIndex === undefined) throw new Error("Broken.")

			if (parentIndex === 0) {
				const rightSibling = this.nodes[parent.values[parentIndex + 1].value]
				if (!rightSibling) throw new Error("Broken.")
				rightSibling.values.unshift(...child.values)
				// No need to update minKey because it should be null.
				// Update parent pointers.
				parent.values[0].value = rightSibling.id
				parent.values.splice(1, 1)
			} else {
				const leftSibling = this.nodes[parent.values[parentIndex - 1].value]
				if (!leftSibling) throw new Error("Broken.")
				leftSibling.values.push(...child.values)
				// No need to update minKey because we added to the right.
				// Update parent pointers.
				parent.values.splice(parentIndex, 1)
			}

			if (parent.values.length < this.minSize) {
			}
		}
	}

	delete = (key: Key) => {
		const root = this.nodes["root"]
		if (!root) return

		// Delete from leaf node.
		const nodePath = [root]
		const indexPath: number[] = []
		while (true) {
			const node = nodePath[0]

			if (node.leaf) {
				const exists = remove(node.values, (x) => compare(x.key, key))
				if (!exists) return
				break
			}

			const result = binarySearch(node.values, (x) => compare(x.key, key))
			const index =
				result.found !== undefined ? result.found : result.closest - 1
			const childId = node.values[index].value
			const child = this.nodes[childId]
			if (!child) throw Error("Missing child node.")
			nodePath.unshift(child)
			indexPath.unshift(index)
		}

		// Balance the tree, starting from the leaf.
		/*

		Example:

		[null,10]
		[null,5] [10,15]
		[2,4] [5,7] [10,11] [15,24]

		Removing 10 from the leaf

		[null,10]
		[null,5] [10,15]
		[2,4] [5,7] [11] [15,24]

		Update the parent minKey

		[null,10]
		[null,5] [11,15]
		[2,4] [5,7] [11] [15,24]

		Loop: Merge

		[null,10]
		[null,5] [11,15]
		[2,4] [5,7] [11,15,24]

		Remove parent key

		[null,10]
		[null,5] [11]
		[2,4] [5,7] [11,15,24]

		Recurse into parent -> Merge,etc.

		[null]
		[null,5,11]
		[2,4] [5,7] [11,15,24]

		Replace the root with child if there is only one key

		*/

		let node = nodePath.shift()
		while (node) {
			if (node.id === "root") {
				if (node.leaf) return
				if (node.values.length === 1) {
					const newRoot = this.nodes[node.values[0].value]
					if (!newRoot) throw new Error("Broken.")
					this.nodes["root"] = { ...newRoot, id: "root" }
				}
				return
			}

			const parent = nodePath.shift()
			const parentIndex = indexPath.shift()
			if (!parent) throw new Error("Broken.")
			if (parentIndex === undefined) throw new Error("Broken.")

			// Update the minKey in the parent.
			if (node.values.length >= this.minSize) {
				const parentItem = parent.values[parentIndex]
				// No need to recusively update the left-most branch.
				if (parentItem.key === null) return

				// No need to recursively update if the minKey didn't change.
				if (parentItem.key === node.values[0].key) return

				// Set the minKey and recur
				parentItem.key = node.values[0].key
				node = parent
				continue
			}

			// Merge
			if (parentIndex === 0) {
				const rightSibling = this.nodes[parent.values[parentIndex + 1].value]
				if (!rightSibling) throw new Error("Broken.")
				rightSibling.values.unshift(...node.values)

				// Remove the old pointer to rightSibling
				parent.values.splice(1, 1)

				// Replace the node pointer with the new rightSibling
				const leftMost = parent.values[0].key === null
				parent.values[0] = {
					key: leftMost ? null : rightSibling.values[0].key,
					value: rightSibling.id,
				}
			} else {
				const leftSibling = this.nodes[parent.values[parentIndex - 1].value]
				if (!leftSibling) throw new Error("Broken.")
				leftSibling.values.push(...node.values)
				// No need to update minKey because we added to the right.
				// Just need to delete the old node.
				parent.values.splice(parentIndex, 1)
			}

			// Recur
			node = parent
			continue
		}
	}

	depth() {
		const root = this.nodes["root"]
		if (!root) return 0
		let depth = 1
		let node = root
		while (!node.leaf) {
			depth += 1
			const nextNode = this.nodes[node.values[0].value]
			if (!nextNode) throw new Error("Broken.")
			node = nextNode
		}
		return depth
	}
}

type BinarySearchResult =
	| { found: number; closest?: undefined }
	| { found?: undefined; closest: number }

function binarySearch<T>(
	list: Array<T>,
	compare: (a: T) => -1 | 0 | 1
): BinarySearchResult {
	var min = 0
	var max = list.length - 1
	while (min <= max) {
		var k = (max + min) >> 1
		var dir = compare(list[k]) * -1
		if (dir > 0) {
			min = k + 1
		} else if (dir < 0) {
			max = k - 1
		} else {
			return { found: k }
		}
	}
	return { closest: min }
}

function compare(
	a: string | number | null,
	b: string | number | null
): -1 | 0 | 1 {
	if (a === b) return 0
	if (a === null) return -1
	if (b === null) return 1
	if (a > b) {
		return 1
	}
	if (a < b) {
		return -1
	}
	return 0
}

function insert<T>(
	value: T,
	list: Array<T>,
	compare: (a: T, b: T) => -1 | 0 | 1
) {
	const result = binarySearch(list, (item) => compare(item, value))
	if (result.found !== undefined) {
		// Replace the whole item.
		list.splice(result.found, 1, value)
	} else {
		// Insert at missing index.
		list.splice(result.closest, 0, value)
	}
}

function replace<T>(
	list: Array<T>,
	compare: (a: T) => -1 | 0 | 1,
	update: (existing?: T) => T
) {
	const result = binarySearch(list, compare)
	if (result.found !== undefined) {
		// Replace the whole item.
		list.splice(result.found, 1, update(list[result.found]))
	} else {
		// Insert at missing index.
		list.splice(result.closest, 0, update())
	}
}

function remove<T>(list: T[], compare: (a: T) => -1 | 0 | 1) {
	let { found } = binarySearch(list, compare)
	if (found !== undefined) {
		// Remove from index.
		return list.splice(found, 1)[0]
	}
}

function randomId() {
	return Math.random().toString(36).slice(2, 10)
}
