/*

Both Postgres and SQLite use B+ trees as the foundation of their indexes.

Even though we have an OrderedKeyValueDatabase, let's build a B+ tree on top of a KeyValueDatabase
so that we can later extend it to an interval tree and a range tree.

TODO:
- delete keys and compact.
- what to do about duplicate keys.
- some basic performance analysis and comparison.
-> interval tree!

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
				continue
			}

			break
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
