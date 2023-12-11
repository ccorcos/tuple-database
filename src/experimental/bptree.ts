/*

Both Postgres and SQLite use B+ trees as the foundation of their indexes.

Even though we have an OrderedKeyValueDatabase, let's build a B+ tree on top of a KeyValueDatabase
so that we can later extend it to an interval tree and a range tree.

TODO:
- assert for more efficient runtime checks.
	write a typescript function called assert(x) that throws an error if x is nullable with a type assertion as well that narrows the type
- some basic performance analysis and comparison.
-> interval tree!

LATER:
- batch insert.

*/

type Key = string | number

/**
 * id references the node in a key-value database.
 * Each item in values has a `key` that is the minKey of the child node with id `value`.
 * The key will be null for the left-most branch nodes.
 */
export type BranchNode = {
	leaf?: false
	id: string
	values: { key: Key | null; value: string }[]
}

export type LeafNode = {
	leaf: true
	id: string
	values: { key: Key | null; value: any }[]
}

export class BinaryPlusTree {
	// In preparation for storing nodes in a key-value database.
	nodes: { [key: Key]: BranchNode | LeafNode | undefined } = {}

	/**
	 * minSize must be less than maxSize / 2.
	 */
	constructor(public minSize: number, public maxSize: number) {
		if (minSize > maxSize / 2) throw new Error("Invalid tree size.")
	}

	get = (key: Key): any | undefined => {
		const root = this.nodes["root"]
		if (!root) return // Empty tree

		let node = root
		while (true) {
			if (node.leaf) {
				const result = binarySearch(node.values, (x) => compare(x.key, key))
				if (result.found === undefined) return
				return node.values[result.found].value
			}

			const result = binarySearch(node.values, (x) => compare(x.key, key))

			// If we find the key in a branch node, recur into that child.
			if (result.found !== undefined) {
				const childId = node.values[result.found].value
				const child = this.nodes[childId]
				if (!child) throw Error("Missing child node.")
				node = child
				continue
			}

			// Closest key that is at least as big as the key...
			// So the closest should never be less than the minKey.
			if (result.closest === 0) throw new Error("Broken.")
			// And we should recurd into the `closest-1` child
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
				const existing = insert({ key, value }, node.values, (x) =>
					compare(x.key, key)
				)
				// No need to rebalance if we're replacing
				if (existing) return
				break
			}

			const result = binarySearch(node.values, (x) => compare(x.key, key))
			const index =
				result.found !== undefined ? result.found : result.closest - 1
			const childId = node.values[index].value
			const child = this.nodes[childId]
			if (!child) throw Error("Missing child node.")
			// Recur into child.
			nodePath.unshift(child)
			indexPath.unshift(index)
		}

		// Balance the tree by splitting nodes, starting from the leaf.
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
			// Recur into the child.
			nodePath.unshift(child)
			indexPath.unshift(index)
		}

		/*

		Step-by-step explanation of the more complicated case.

		Imagine a tree with minSize = 2, maxSize = 4.

		[null,10]
		[null,5] [10,15]
		[2,4] [5,7] [10,11] [15,24]

		Removing 10 from the leaf

		[null,10]
		[null,5] [10,15]
		[2,4] [5,7] [11] [15,24]

		Loop: Merge and update parent pointers.

		[null,10]
		[null,5] [11]
		[2,4] [5,7] [11,15,24]

		Recurse into parent.

		[null]
		[null,5,11]
		[2,4] [5,7] [11,15,24]

		Replace the root with child if there is only one key

		[null,5,11]
		[2,4] [5,7] [11,15,24]

		*/

		let node = nodePath.shift()
		while (node) {
			if (node.id === "root") {
				// A root leaf node has no minSize constaint.
				if (node.leaf) return

				// If node with only one child becomes its child.
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

			if (node.values.length >= this.minSize) {
				// No need to merge but we might need to update the minKey in the parent
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

			// Merge or redistribute
			if (parentIndex === 0) {
				const rightSibling = this.nodes[parent.values[parentIndex + 1].value]
				if (!rightSibling) throw new Error("Broken.")

				const combinedSize = node.values.length + rightSibling.values.length
				if (combinedSize > this.maxSize) {
					// Redistribute
					const splitIndex = Math.round(combinedSize / 2) - node.values.length
					const moveLeft = rightSibling.values.splice(0, splitIndex)
					node.values.push(...moveLeft)

					// Update parent keys.
					if (parent.values[parentIndex].key !== null) {
						parent.values[parentIndex].key = node.values[0].key
					}
					parent.values[parentIndex + 1].key = rightSibling.values[0].key
				} else {
					// Merge
					rightSibling.values.unshift(...node.values)

					// Remove the old pointer to rightSibling
					parent.values.splice(1, 1)

					// Replace the node pointer with the new rightSibling
					const leftMost = parent.values[0].key === null
					parent.values[0] = {
						key: leftMost ? null : rightSibling.values[0].key,
						value: rightSibling.id,
					}
				}
			} else {
				const leftSibling = this.nodes[parent.values[parentIndex - 1].value]
				if (!leftSibling) throw new Error("Broken.")

				const combinedSize = leftSibling.values.length + node.values.length
				if (combinedSize > this.maxSize) {
					// Redistribute
					const splitIndex = Math.round(combinedSize / 2)

					const moveRight = leftSibling.values.splice(splitIndex, this.maxSize)
					node.values.unshift(...moveRight)

					// Update parent keys.
					parent.values[parentIndex].key = node.values[0].key
				} else {
					// Merge

					leftSibling.values.push(...node.values)
					// No need to update minKey because we added to the right.
					// Just need to delete the old node.
					parent.values.splice(parentIndex, 1)
				}
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
		return list.splice(result.found, 1, value)
	} else {
		// Insert at missing index.
		list.splice(result.closest, 0, value)
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
