/*

Both Postgres and SQLite use B+ trees as the foundation of their indexes.

Even though we have an OrderedKeyValueDatabase, let's build a B+ tree on top of a KeyValueDatabase
so that we can later extend it to an interval tree and a range tree.

*/

/*

Demonstration

Order: 3
minSize: 2

Inserts -> [5, 10, 3, 6, 14, 24, 20, 22, 12, 11, 2, 13]

5 -> [5]
10 -> [5,10]
3 -> [3,5,10]
6 -> [3,5,6,10]
	-> First split
	-> [6]
	[3,5] [6,10]
14 -> [6]
	[3,5] [6,10,14]
24 -> [6]
	[3,5] [6,10,14,24]
	-> Second split
	-> [6,14]
	[3,5] [6,10] [14,24]
20 -> [6,14]
	[3,5] [6,10] [14,20,24]
22 -> [6,14]
	[3,5] [6,10] [14,20,22,24]
	-> Third split
	-> [6,14,22]
	[3,5] [6,10] [14,20] [22,24]
12 -> [6,14,22]
	[3,5] [6,10,12] [14,20] [22,24]
11 -> [6,14,22]
	[3,5] [6,10,11,12] [14,20] [22,24]
	-> Double split
	-> [6,11,14,22]
	[3,5] [6,10] [11,12] [14,20] [22,24]
	-> [14]
	  [6,11] [14,22]
	[3,5] [6,10] [11,12] [14,20] [22,24]
2 -> [14]
	  [6,11] [14,22]
	[2,3,5] [6,10] [11,12] [14,20] [22,24]
13 -> Update parent minKey
   -> [14]
	[6,11] [13,22]
[2,3,5] [6,10] [11,12] [13,14,20] [22,24]
*/

type Key = string | number

export type BranchNode = {
	leaf?: false
	id: string
	// nodes: { minKey: Key; id: string }[]
	values: { key: Key; value: string }[]
}

export type LeafNode = {
	leaf: true
	id: string
	values: { key: Key; value: any }[]
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
			// Left-most node key is always "" so closest should never be 0.
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
			if (result.found !== undefined) {
				const childId = node.values[result.found].value
				const child = this.nodes[childId]
				if (!child) throw Error("Missing child node.")
				nodePath.push(child)
				indexPath.push(result.found)
				continue
			}
		}

		// Balance the tree, starting from the leaf.
		let node = nodePath.shift()
		while (node) {
			const size = node.values.length

			if (size > this.maxSize) {
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
						...node,
						id: randomId(),
					}
					this.nodes[leftNode.id] = leftNode

					this.nodes["root"] = {
						id: "root",
						values: [
							{ key: "", value: leftNode.id },
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

				// Update parent key for the left node.
				// If parentIndex is 0, then the key should remain "".
				if (parentIndex !== 0) {
					const minKey = node.values[0].key
					if (parent.values[parentIndex].key !== minKey) {
						parent.values[parentIndex] = { key: minKey, value: node.id }
					}
				}

				// Recur
				node = parent
				continue
			}

			// No splitting going on, just need to update the minKey in the parent.
			const parent = nodePath.shift()
			const parentIndex = indexPath.shift()
			if (node.id !== "root") {
				if (!parent) throw new Error("Broken.")
				if (parentIndex === undefined) throw new Error("Broken.")
				if (parentIndex !== 0) {
					const minKey = node.values[0].key
					if (parent.values[parentIndex].key !== minKey) {
						parent.values[parentIndex] = { key: minKey, value: node.id }
					}
				}
			}

			// Recur
			node = parent
		}
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

function compare<K extends string | number | boolean | Date>(
	a: K,
	b: K
): -1 | 0 | 1 {
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
