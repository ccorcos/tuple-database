import { randomId } from "../helpers/randomId"
import {
	Bounds,
	isTupleWithinBounds,
	normalizeTupleBounds,
	prefixTupleBounds,
} from "../helpers/sortedTupleArray"
import { InMemoryTupleDatabase } from "./InMemoryTupleDatabase"
import { TupleDatabase } from "./TupleDatabase"
import { MIN, ScanArgs, Tuple, TupleStorage, TxId, Writes } from "./types"

export type Callback = (write: Writes) => void

type Listener = { callback: Callback; bounds: Bounds }

export class ReactiveTupleDatabase extends TupleDatabase {
	debug = false

	constructor(storage: TupleStorage) {
		super(storage)
	}

	commit(writes: Writes, txId?: TxId) {
		const updates = this.getEmits(writes)
		super.commit(writes, txId)
		for (const [callback, writes] of updates.entries()) {
			callback(writes)
		}
	}

	private listeners = new InMemoryTupleDatabase()

	subscribe = (args: ScanArgs, callback: Callback) => {
		// this.log("db/subscribe", args)

		const bounds = normalizeTupleBounds(args)
		const prefix = prefixTupleBounds(bounds)

		const id = randomId()
		const value: Listener = { callback, bounds }

		this.listeners.transact().set([prefix, id], value).commit()

		const unsubscribe = () => {
			// this.log("db/unsubscribe", args)
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

			if (isTupleWithinBounds(tuple, bounds)) {
				callbacks.push(callback)
			} else {
				// TODO: track how in-efficient listeners are here.
				// NOTE: the bounds may only partially span the prefix.
			}
		}

		return callbacks
	}

	private getEmits = (writes: Writes) => {
		const emits = new Map<Callback, Required<Writes>>()

		for (const [tuple, value] of writes.set || []) {
			const callbacks = this.getCallbacksForTuple(tuple)
			for (const callback of callbacks) {
				if (!emits.has(callback)) emits.set(callback, { set: [], remove: [] })
				emits.get(callback)!.set.push([tuple, value])
			}
		}

		for (const tuple of writes.remove || []) {
			const callbacks = this.getCallbacksForTuple(tuple)
			for (const callback of callbacks) {
				if (!emits.has(callback)) emits.set(callback, { set: [], remove: [] })
				emits.get(callback)!.remove.push(tuple)
			}
		}

		return emits
	}
}

function iterateTuplePrefixes(tuple: Tuple) {
	const prefixes: Tuple[] = []
	for (let i = 0; i < tuple.length; i++) {
		const prefix = tuple.slice(0, i)
		prefixes.push(prefix)
	}
	return prefixes
}
