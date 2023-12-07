/*
Try this: https://www.youtube.com/watch?v=q0QOYtSsTg4

- [ ] diff between avl and red-black tree.
- [ ] generalized search tree. start with a btree for practice?


GiST Required Methods:  insert, delete, search, chooseSubtree, split, and consolidate.
https://speakerdeck.com/jhellerstein/gist-a-generalized-search-tree-for-database-systems?slide=10

*/

import { KeyValueDatabase } from "./kv"

// TODO:
// - start with a basic b-tree
// - save it with kv and consistency checks
// - add balancing
// - making it b+
// - implement as GiST.
// - extend to interval / range.

// export class KeyValueDatabase {
// 	private map: { [key: string]: { value: any; version: string } } = {}

// 	get = (key: string): { value: any; version: string } | undefined => {
// 		const existing = this.map[key]
// 		if (existing) return existing
// 	}

// 	write(tx: {
// 		check?: { key: string; version: string }[]
// 		set?: { key: string; value: any }[]
// 		delete?: string[]
// 		sum?: { key: string; value: number }[]
// 		min?: { key: string; value: number }[]
// 		max?: { key: string; value: number }[]
// 	}) {

class KeyValueTransaction {
	constructor(private kv: KeyValueDatabase) {}
	private checks: { key: string; version: string | undefined }[] = []
	private sets: { [key: string]: any } = {}
	private deletes = new Set<string>()
	private cache: { [kesy: string]: any } = {}

	get(key: string): RedBlackNode | undefined {
		if (this.deletes.has(key)) return
		if (key in this.sets) return this.sets[key]
		if (key in this.cache) return this.cache[key]
		const result = this.kv.get(key)
		this.checks.push({ key, version: result?.version })
		this.cache[key] = result?.value
		return result?.value
	}

	set(key: string, value: RedBlackNode) {
		this.deletes.delete(key)
		this.sets[key] = value
	}

	update(key: string, props: Partial<RedBlackNode>) {
		this.deletes.delete(key)
		const existing = this.get(key)
		if (!existing) throw new Error("Does not exist.")
		this.sets[key] = { ...existing, ...props }
	}
}

const RED = 0 as const
const BLACK = 1 as const

type RedBlackNode = {
	id: string
	color: 1 | 0
	key: string
	value: any
	leftId?: string
	rightId?: string
}

class RedBlackTree {
	constructor(private kv: KeyValueDatabase, private name: string) {}

	insert = (key: string, value: any) => {
		const tx = new KeyValueTransaction(this.kv)

		// Find path to insert new node.
		let n = tx.get(this.name)
		const n_stack: string[] = []
		const d_stack: (-1 | 0 | 1)[] = []
		while (n) {
			const d = compare(key, n.key)
			n_stack.push(n.id)
			d_stack.push(d)
			if (d === 0) break
			else if (d < 0) {
				if (!n.leftId) break
				n = tx.get(n.leftId)
			} else {
				if (!n.rightId) break
				n = tx.get(n.rightId)
			}
		}

		// Rebuild path to leaf node.
		const newNode: RedBlackNode = {
			id: randomId(),
			color: RED,
			key,
			value,
			// count: 1,
		}
		tx.set(key, newNode)
		n_stack.push(newNode.id)
		for (let s = n_stack.length - 2; s >= 0; --s) {
			let n = n_stack[s]
			const nn = tx.get(n)!
			if (d_stack[s] <= 0) {
				if (nn.leftId !== n_stack[s + 1]) {
					tx.update(nn.id, { leftId: n_stack[s + 1] })
				}
				// n.setCount(n.count + 1)
			} else {
				if (nn.rightId !== n_stack[s + 1]) {
					tx.update(nn.id, { rightId: n_stack[s + 1] })
				}
				// n.setCount(n.count + 1)
			}
		}

		// 8 types of rotations.
		// Rebalance tree using rotations
		// console.log("start insert", key, d_stack)
		for (let s = n_stack.length - 1; s > 1; --s) {
			let p = n_stack[s - 1]
			const pn = tx.get(p)!
			let n = n_stack[s]
			const nn = tx.get(n)!
			if (pn.color === BLACK || nn.color === BLACK) break

			let pp = n_stack[s - 2]
			const ppn = tx.get(pp)!
			if (ppn.leftId === pn.id) {
				if (pn.leftId === nn.id) {
					let y = ppn.rightId ? tx.get(ppn.rightId) : undefined
					if (y && y.color === RED) {
						//
						//      (pp)
						//      /  \
						//    (p)  (y)
						//    /
						//  (n)
						//
						// console.log("LLr")
						tx.set(pn.id, { ...pn, color: BLACK })
						tx.update(y.id, { color: BLACK })
						tx.update(ppn.id, { rightId: y.id, color: RED })
						s -= 1
					} else {
						// console.log("LLb")
						tx.update(ppn.id, { color: RED, leftId: pn.rightId })
						tx.update(pn.id, { color: BLACK, rightId: ppn.id })
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						// await recount(pp)
						// await recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							const pppn = tx.get(ppp)!
							if (pppn.leftId === ppn.id) {
								tx.update(pppn.id, { leftId: pn.id })
							} else {
								tx.update(pppn.id, { rightId: pn.id })
							}
						}
						break
					}
				} else {
					let y = ppn.rightId ? tx.get(ppn.rightId) : undefined
					if (y && y.color === RED) {
						// console.log("LRr")
						tx.update(pn.id, { color: BLACK })
						tx.update(y.id, { color: BLACK })
						tx.update(ppn.id, { rightId: y.id, color: RED })
						s -= 1
					} else {
						// console.log("LRb")
						tx.update(pn.id, { rightId: nn.leftId })
						tx.update(ppn.id, { color: RED, leftId: nn.rightId })
						tx.update(nn.id, { color: BLACK, leftId: pn.id, rightId: ppn.id })
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						// await recount(pp)
						// await recount(p)
						// await recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							const pppn = tx.get(ppp)!
							if (pppn.leftId === ppn.id) {
								tx.update(pppn.id, { leftId: nn.id })
							} else {
								tx.update(pppn.id, { rightId: nn.id })
							}
						}
						break
					}
				}
			} else {
				if (pn.rightId === nn.id) {
					let y = ppn.leftId ? tx.get(ppn.leftId) : undefined
					if (y && y.color === RED) {
						// console.log("RRr", y.key)
						tx.update(pn.id, { color: BLACK })
						tx.update(y.id, { color: BLACK })
						tx.update(ppn.id, { leftId: y.id, color: RED })
						s -= 1
					} else {
						// console.log("RRb")
						tx.update(ppn.id, { color: RED, rightId: pn.leftId })
						tx.update(pn.id, { color: BLACK, leftId: ppn.id })
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						// await recount(pp)
						// await recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							const pppn = tx.get(ppp)!
							if (pppn.rightId === ppn.id) {
								tx.update(pppn.id, { rightId: pn.id })
							} else {
								tx.update(pppn.id, { leftId: pn.id })
							}
						}
						break
					}
				} else {
					let y = ppn.leftId ? tx.get(ppn.leftId) : undefined
					if (y && y.color === RED) {
						// console.log("RLr")
						tx.update(pn.id, { color: BLACK })
						tx.update(y.id, { color: BLACK })
						tx.update(ppn.id, { leftId: y.id, color: RED })
						s -= 1
					} else {
						// console.log("RLb")

						tx.update(pn.id, { leftId: nn.rightId })
						tx.update(ppn.id, { color: RED, rightId: nn.leftId })
						tx.update(nn.id, { color: BLACK, rightId: pn.id, leftId: ppn.id })
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						// await recount(pp)
						// await recount(p)
						// await recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							const pppn = tx.get(ppp)!
							if (pppn.rightId === ppn.id) {
								tx.update(pppn.id, { rightId: nn.id })
							} else {
								tx.update(pppn.id, { leftId: nn.id })
							}
						}
						break
					}
				}
			}
		}

		// Return new tree
		n_stack[0].setColor(BLACK)
		const newRootId = n_stack[0].id
		await transaction.commit()
		return new RedBlackTree(
			{ compare: this.compare, rootId: newRootId },
			this.store
		)
	}
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

function randomId() {
	return Math.random().toString(36).slice(2, 10)
}
