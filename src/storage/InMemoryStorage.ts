import * as t from "../helpers/sortedTupleArray"
import * as tv from "../helpers/sortedTupleValuePairs"
import {
	Indexer,
	ScanArgs,
	Transaction,
	Tuple,
	TupleStorage,
	TupleValuePair,
	TxId,
	Writes,
} from "./types"

type WriteLogItem =
	| { type: "tx-start"; txId: TxId }
	| { type: "write"; tuples: Tuple[] }

/*

WriteLog is a list of concurrent writes.
- tx1
- ["a"] // left over from tx2
- tx3
- ["b"] // left over from tx2

When tx1 commits, it will have to reconcile its reads with the
concurrent writes.
*/
type WriteLog = WriteLogItem[]

function* iterateWrittenTuples(write: Writes) {
	for (const [tuple, _value] of write.set || []) {
		yield tuple
	}
	for (const tuple of write.remove || []) {
		yield tuple
	}
}

function getWrittenTuples(write: Writes) {
	return Array.from(iterateWrittenTuples(write))
}

function iterate<T>(array: T[]): [number, T][] {
	const pairs: [number, T][] = []
	for (let i = 0; i < array.length; i++) {
		pairs.push([i, array[i]])
	}
	return pairs
}

function iterateReverse<T>(array: T[]): [number, T][] {
	const pairs: [number, T][] = []
	for (let i = array.length - 1; i >= 0; i--) {
		pairs.push([i, array[i]])
	}
	return pairs
}

export class InMemoryStorage implements TupleStorage {
	data: TupleValuePair[]

	constructor(data?: TupleValuePair[]) {
		this.data = data || []
	}

	indexers: Indexer[] = []

	index(indexer: Indexer) {
		this.indexers.push(indexer)
		return this
	}

	get(tuple: Tuple) {
		return tv.get(this.data, tuple)
	}

	exists(tuple: Tuple) {
		return tv.exists(this.data, tuple)
	}

	scan(args: ScanArgs = {}) {
		return tv.scan(this.data, args)
	}

	// Keep track of concurrent read/writes.
	private writeLog: WriteLog = []

	private nextTxId: TxId = 0
	private createTxId = () => {
		const txId = this.nextTxId
		this.nextTxId += 1
		this.writeLog.push({ type: "tx-start", txId })
		return txId
	}

	transact() {
		return new InMemoryTransaction(this, this.createTxId())
	}

	// TODO: it's unclear what the consequences are of this ordering.
	// Also, if we were to run more indexers after this bulk write, what are the race conditions?
	commit(writes: Writes, txId?: number, reads: t.Bounds[] = []) {
		if (!txId) txId = this.createTxId()

		let conflict: { tuple: Tuple; read: t.Bounds } | undefined
		for (const [i, item] of iterateReverse(this.writeLog)) {
			// Search for conflicts in this write.
			if (!conflict) {
				if (item.type === "write") {
					checkConflict: for (const tuple of item.tuples) {
						for (const read of reads) {
							if (t.isTupleWithinBounds(tuple, read)) {
								conflict = { tuple, read }
								// Continue with cleanup and throw the conflict error after.
								break checkConflict
							}
						}
					}
				}
			}

			// Look for the txId and cleanup the log, even if there's a conflict.
			if (item.type === "tx-start" && item.txId === txId) {
				// If we've made it to the beginning of the log.
				if (i === 0) {
					// Delete the tx-start item.
					this.writeLog.shift()
					// And keep deleting writes until we've made it to the next transaction.
					while (this.writeLog.length && this.writeLog[0].type === "write")
						this.writeLog.shift()
				} else {
					// Otherwise, we just remove the tx-start item.
					this.writeLog.splice(i, 1)
				}
				break
			}
		}

		if (conflict)
			throw new Error("Conflict: " + JSON.stringify(conflict, null, 2))

		// If the writeLog is empty, then there are no active transactions so we don't
		// need to record.
		if (this.writeLog.length)
			this.writeLog.push({ type: "write", tuples: getWrittenTuples(writes) })

		const { set, remove } = writes
		for (const tuple of remove || []) {
			tv.remove(this.data, tuple)
		}
		for (const [tuple, value] of set || []) {
			tv.set(this.data, tuple, value)
		}
	}

	close() {
		// Nothing happens really. This is more important for SQLite.
		return
	}
}

export interface TransactionArgs {
	indexers: Indexer[]
	get(tuple: Tuple): any
	exists(tuple: Tuple): boolean
	scan(args: ScanArgs): TupleValuePair[]
	commit(writes: Writes, txId: number, reads: t.Bounds[]): void
}

export class InMemoryTransaction implements Transaction {
	constructor(private storage: TransactionArgs, public id: TxId) {}

	writes: Required<Writes> = { set: [], remove: [] }

	reads: t.Bounds[] = []

	get(tuple: Tuple) {
		this.reads.push({ gte: tuple, lte: tuple })

		// TODO: binary searching twice unnecessarily...
		if (tv.exists(this.writes.set, tuple)) {
			return tv.get(this.writes.set, tuple)
		}
		if (t.exists(this.writes.remove, tuple)) {
			return
		}
		return this.storage.get(tuple)
	}

	exists(tuple: Tuple) {
		this.reads.push({ gte: tuple, lte: tuple })

		if (tv.exists(this.writes.set, tuple)) {
			return true
		}
		if (t.exists(this.writes.remove, tuple)) {
			return false
		}
		return this.storage.exists(tuple)
	}

	set(tuple: Tuple, value: any) {
		// Don't fetch this if we don't need it for the indexers.
		const prev = this.storage.indexers.length ? this.get(tuple) : null
		t.remove(this.writes.remove, tuple)
		tv.set(this.writes.set, tuple, value)
		for (const indexer of this.storage.indexers) {
			indexer(this, { type: "set", tuple, value, prev })
		}
		return this
	}

	remove(tuple: Tuple) {
		// Don't fetch this if we don't need it for the indexers.
		const prev = this.storage.indexers.length ? this.get(tuple) : null
		tv.remove(this.writes.set, tuple)
		t.set(this.writes.remove, tuple)
		for (const indexer of this.storage.indexers) {
			indexer(this, { type: "remove", tuple, prev })
		}
		return this
	}

	write(writes: Writes) {
		// TODO: it's unclear what the consequences are of this ordering.
		// Also, if we were to run more indexers after this bulk write, what are the race conditions?
		const { set, remove } = writes
		for (const tuple of remove || []) {
			this.remove(tuple)
		}
		for (const [tuple, value] of set || []) {
			this.set(tuple, value)
		}
		return this
	}

	scan(args: ScanArgs = {}) {
		// TODO: read could also just be bounds. There's a perf trade-off.
		// More granular reactivity at a
		const bounds = t.normalizeTupleBounds(args)
		this.reads.push(bounds)

		const result = this.storage.scan(args)
		const sets = tv.scan(this.writes.set, args)
		for (const [tuple, value] of sets) {
			tv.set(result, tuple, value)
		}
		const removes = t.scan(this.writes.remove, args)
		for (const tuple of removes) {
			tv.remove(result, tuple)
		}
		return result
	}

	commit() {
		return this.storage.commit(this.writes, this.id, this.reads)
	}
}
