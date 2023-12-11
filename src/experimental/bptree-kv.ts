/*

Both Postgres and SQLite use B+ trees as the foundation of their indexes.

Even though we have an OrderedKeyValueDatabase, let's build a B+ tree on top of a KeyValueDatabase
so that we can later extend it to an interval tree and a range tree.

*/

import { KeyValueDatabase } from "./kv"

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

export class BinaryPlusTreeDatabase<V = any> {
	/**
	 * minSize must be less than maxSize / 2.
	 */
	constructor(
		public kv: KeyValueDatabase<LeafNode | BranchNode>,
		public minSize: number,
		public maxSize: number
	) {
		if (minSize > maxSize / 2) throw new Error("Invalid tree size.")
	}

	// TODO: underlying storage concurrency checks when async.
	get = (key: Key): V | undefined => {
		const tx = new KeyValueTransaction(this.kv)

		const root = tx.get("root")
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
				const child = tx.get(childId)
				if (!child) throw Error("Missing child node.")
				node = child
				continue
			}

			// Closest key that is at least as big as the key...
			// So the closest should never be less than the minKey.
			if (result.closest === 0) throw new Error("Broken.")
			// And we should recurd into the `closest-1` child
			const childId = node.values[result.closest - 1].value
			const child = tx.get(childId)
			if (!child) throw Error("Missing child node.")
			node = child
		}
	}

	set = (key: Key, value: any) => {
		const tx = new KeyValueTransaction(this.kv)
		const root = tx.get("root")

		// Intitalize root node.
		if (!root) {
			tx.set("root", {
				leaf: true,
				id: "root",
				values: [{ key, value }],
			})
			tx.commit()
			return
		}

		// Insert into leaf node.
		const nodePath = ["root"]
		const indexPath: number[] = []
		while (true) {
			const nodeId = nodePath[0]
			const node = tx.get(nodeId)
			if (!node) throw new Error("Missing node.")

			if (node.leaf) {
				const newNode = { ...node, values: [...node.values] }
				const existing = insert({ key, value }, newNode.values, (x) =>
					compare(x.key, key)
				)
				tx.set(newNode.id, newNode)
				// No need to rebalance if we're replacing
				if (existing) {
					tx.commit()
					return
				}
				break
			}

			const result = binarySearch(node.values, (x) => compare(x.key, key))
			const index =
				result.found !== undefined ? result.found : result.closest - 1
			const childId = node.values[index].value

			// Recur into child.
			nodePath.unshift(childId)
			indexPath.unshift(index)
		}

		// Balance the tree by splitting nodes, starting from the leaf.
		let nodeId = nodePath.shift()
		while (nodeId) {
			const node = tx.get(nodeId)
			if (!node) throw new Error("Missing node.")

			const size = node.values.length
			if (size <= this.maxSize) break

			const splitIndex = Math.round(size / 2)
			const rightNode: LeafNode | BranchNode = {
				id: randomId(),
				leaf: node.leaf,
				values: node.values.splice(splitIndex),
			}
			tx.set(rightNode.id, rightNode)
			const rightMinKey = rightNode.values[0].key

			// If we're splitting the root node.
			if (node.id === "root") {
				const leftNode: LeafNode | BranchNode = {
					id: randomId(),
					leaf: node.leaf,
					values: node.values,
				}
				tx.set(leftNode.id, leftNode)

				tx.set("root", {
					id: "root",
					values: [
						{ key: null, value: leftNode.id },
						{ key: rightMinKey, value: rightNode.id },
					],
				})
				break
			}

			// Insert right node into parent.
			const parentId = nodePath.shift()
			if (!parentId) throw new Error("Broken.")
			const parent = tx.get(parentId)
			if (!parent) throw new Error("Broken.")
			const parentIndex = indexPath.shift()
			if (parentIndex === undefined) throw new Error("Broken.")

			const newParent = {
				...parent,
				values: [...parent.values],
			}
			newParent.values.splice(parentIndex + 1, 0, {
				key: rightMinKey,
				value: rightNode.id,
			})
			tx.set(newParent.id, newParent)

			// Recur
			nodeId = parent.id
		}

		tx.commit()
	}

	delete = (key: Key) => {
		const tx = new KeyValueTransaction(this.kv)
		const root = tx.get("root")
		if (!root) return

		// Delete from leaf node.
		const nodePath = ["root"]
		const indexPath: number[] = []
		while (true) {
			const node = tx.get(nodePath[0])
			if (!node) throw new Error("Missing node.")

			if (node.leaf) {
				const newNode = { ...node, values: [...node.values] }
				const exists = remove(newNode.values, (x) => compare(x.key, key))
				tx.set(newNode.id, newNode)
				if (!exists) {
					tx.commit()
					return
				}
				break
			}

			const result = binarySearch(node.values, (x) => compare(x.key, key))
			const index =
				result.found !== undefined ? result.found : result.closest - 1
			const childId = node.values[index].value
			// Recur into the child.
			nodePath.unshift(childId)
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

		let nodeId = nodePath.shift()
		while (nodeId) {
			const node = tx.get(nodeId)
			if (!node) throw new Error("Missing node.")

			if (node.id === "root") {
				// A root leaf node has no minSize constaint.
				if (node.leaf) {
					tx.commit()
					return
				}

				// If node with only one child becomes its child.
				if (node.values.length === 1) {
					const newRoot = tx.get(node.values[0].value)
					if (!newRoot) throw new Error("Broken.")
					tx.set("root", { ...newRoot, id: "root" })
				}
				tx.commit()
				return
			}

			const parentId = nodePath.shift()
			if (!parentId) throw new Error("Broken.")
			const parent = tx.get(parentId)
			if (!parent) throw new Error("Broken.")
			const parentIndex = indexPath.shift()
			if (parentIndex === undefined) throw new Error("Broken.")

			if (node.values.length >= this.minSize) {
				// No need to merge but we might need to update the minKey in the parent
				const parentItem = parent.values[parentIndex]
				// No need to recusively update the left-most branch.
				if (parentItem.key === null) {
					tx.commit()
					return
				}
				// No need to recursively update if the minKey didn't change.
				if (parentItem.key === node.values[0].key) {
					tx.commit()
					return
				}
				// Set the minKey and recur
				const newParent = { ...parent, values: [...parent.values] }
				newParent[parentIndex] = {
					key: node.values[0].key,
					value: node.id,
				}
				tx.set(newParent.id, newParent)

				nodeId = parent.id
				continue
			}

			// Merge or redistribute
			if (parentIndex === 0) {
				const rightSibling = tx.get(parent.values[parentIndex + 1].value)
				if (!rightSibling) throw new Error("Broken.")

				const combinedSize = node.values.length + rightSibling.values.length
				if (combinedSize > this.maxSize) {
					// Redistribute
					const splitIndex = Math.round(combinedSize / 2) - node.values.length

					const newRight = { ...rightSibling, values: [...rightSibling.values] }
					const moveLeft = newRight.values.splice(0, splitIndex)
					tx.set(newRight.id, newRight)

					const newNode = { ...node, values: [...node.values] }
					newNode.values.push(...moveLeft)
					tx.set(newNode.id, newNode)

					// Update parent keys.
					const newParent = { ...parent, values: [...parent.values] }
					if (parent.values[parentIndex].key !== null) {
						newParent.values[parentIndex] = {
							key: newNode.values[0].key,
							value: newNode.id,
						}
					}
					newParent.values[parentIndex + 1] = {
						key: newRight.values[0].key,
						value: newRight.id,
					}
					tx.set(newParent.id, newParent)
				} else {
					// Merge
					const newRight = { ...rightSibling, values: [...rightSibling.values] }
					newRight.values.unshift(...node.values)
					tx.set(newRight.id, newRight)

					const newParent = { ...parent, values: [...parent.values] }
					// Remove the old pointer to rightSibling
					newParent.values.splice(1, 1)

					// Replace the node pointer with the new rightSibling
					const leftMost = parent.values[0].key === null
					newParent.values[0] = {
						key: leftMost ? null : newRight.values[0].key,
						value: newRight.id,
					}
					tx.set(newParent.id, newParent)
				}
			} else {
				//
				//
				// HERE
				//
				//
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

export class KeyValueTransaction<V = any> {
	cache: { [key: string]: V | undefined } = {}
	checks: { [key: string]: string | undefined } = {}
	sets: { [key: string]: V } = {}
	deletes = new Set<string>()

	constructor(public kv: KeyValueDatabase<V>) {}

	get = (key: string): V | undefined => {
		if (key in this.cache) return this.cache[key]
		const result = this.kv.get(key)
		this.checks[key] = result.version
		this.cache[key] = result.value
		return result.value
	}

	set(key: string, value: V) {
		this.sets[key] = value
		this.cache[key] = value
		this.deletes.delete(key)
	}

	delete(key: string) {
		this.cache[key] = undefined
		delete this.sets[key]
		this.deletes.add(key)
	}

	commit() {
		this.kv.write({
			check: Object.entries(this.checks).map(([key, version]) => ({
				key,
				version,
			})),
			set: Object.entries(this.sets).map(([key, value]) => ({
				key,
				value,
			})),
			delete: Array.from(this.deletes),
		})
	}
}
