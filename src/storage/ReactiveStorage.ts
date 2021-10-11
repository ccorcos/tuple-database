import { compareTuple } from "../helpers/compareTuple"
import { randomId } from "../helpers/randomId"
import { Bounds, normalizeTupleBounds } from "../helpers/sortedTupleArray"
import { InMemoryStorage, InMemoryTransaction } from "./InMemoryStorage"
import {
	Indexer,
	MIN,
	ScanArgs,
	Tuple,
	TupleStorage,
	Value,
	Writes,
} from "./types"

export type Callback = (write: Writes) => void

type Listener = { callback: Callback; bounds: Bounds }

export class ReactiveStorage implements TupleStorage {
	debug = false

	constructor(private storage: TupleStorage) {}

	private log(...args: any[]) {
		if (this.debug) {
			console.log(...args)
		}
	}

	get(tuple: Tuple) {
		return this.storage.get(tuple)
	}

	exists(tuple: Tuple) {
		return this.storage.exists(tuple)
	}

	scan(args?: ScanArgs) {
		return this.storage.scan(args)
	}

	indexers: Indexer[] = []

	index(indexer: Indexer) {
		this.indexers.push(indexer)
		return this
	}

	transact() {
		// NOTE: we're bypassing the storage transaction.
		return new InMemoryTransaction(this)
	}

	commit(writes: Writes) {
		const updates = this.getEmits(writes)
		this.storage.commit(writes)
		for (const [callback, writes] of updates.entries()) {
			callback(writes)
		}
	}

	close() {
		return this.storage.close()
	}

	private listeners = new InMemoryStorage()

	subscribe = (args: ScanArgs, callback: Callback) => {
		this.log("db/subscribe", args)

		const bounds = normalizeTupleBounds(args)
		const prefix = getBoundsPrefix(bounds)

		const id = randomId()
		const value: Listener = { callback, bounds }

		this.listeners.transact().set([prefix, id], value).commit()

		const unsubscribe = () => {
			this.log("db/unsubscribe", args)
			this.listeners.transact().remove([prefix, id]).commit()
		}

		return unsubscribe
	}

	private getListenersForTuple(tuple: Tuple) {
		const listeners: Listener[] = []

		// Look for listeners at each prefix of the tuple.
		for (const prefix of iterateTuplePrefixes(tuple)) {
			// this.listeners.transact().set([prefix, id], { callback, bounds }).commit()
			const results = this.listeners.scan({
				gte: [prefix],
				lt: [[...prefix, MIN]],
			})

			for (const [_prefix, value] of results) {
				listeners.push(value)
			}
		}

		return listeners
	}

	private getCallbacksForTuple(tuple: Tuple) {
		const callbacks: Callback[] = []

		// Check that the tuple is within the absolute bounds of the query.
		for (const listener of this.getListenersForTuple(tuple)) {
			const { callback, bounds } = listener

			if (isWithinTupleBounds(tuple, bounds)) {
				callbacks.push(callback)
			} else {
				// TODO: track how in-efficient listeners are here.
				// NOTE: the bounds may only partially span the prefix.
			}
		}

		return callbacks
	}

	private getEmits = (writes: Writes) => {
		const emits = new Map<Callback, Writes>()

		for (const [tuple, value] of writes.sets) {
			const callbacks = this.getCallbacksForTuple(tuple)
			for (const callback of callbacks) {
				if (!emits.has(callback)) emits.set(callback, { sets: [], removes: [] })
				emits.get(callback)!.sets.push([tuple, value])
			}
		}

		for (const tuple of writes.removes) {
			const callbacks = this.getCallbacksForTuple(tuple)
			for (const callback of callbacks) {
				if (!emits.has(callback)) emits.set(callback, { sets: [], removes: [] })
				emits.get(callback)!.removes.push(tuple)
			}
		}

		return emits
	}
}

/** Compute the prefix that captures all bounds. */
function getBoundsPrefix(bounds: Bounds) {
	const prefix: Value[] = []
	const start = bounds.gt || bounds.gte || []
	const end = bounds.lt || bounds.lte || []
	const len = Math.min(start.length, end.length)
	for (let i = 0; i < len; i++) {
		if (start[i] === end[i]) {
			prefix.push(start[i])
		} else {
			break
		}
	}
	return prefix
}

function iterateTuplePrefixes(tuple: Tuple) {
	const prefixes: Tuple[] = []
	for (let i = 0; i < tuple.length; i++) {
		const prefix = tuple.slice(0, i)
		prefixes.push(prefix)
	}
	return prefixes
}

function isWithinTupleBounds(tuple: Tuple, bounds: Bounds) {
	if (bounds.gt) {
		if (compareTuple(tuple, bounds.gt) !== 1) {
			return false
		}
	}
	if (bounds.gte) {
		if (compareTuple(tuple, bounds.gte) === -1) {
			return false
		}
	}
	if (bounds.lt) {
		if (compareTuple(tuple, bounds.lt) !== -1) {
			return false
		}
	}
	if (bounds.lte) {
		if (compareTuple(tuple, bounds.lte) === 1) {
			return false
		}
	}
	return true
}
