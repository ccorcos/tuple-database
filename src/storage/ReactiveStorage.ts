import { randomId } from "../helpers/randomId"
import { getBounds, Bounds, isWithinBounds } from "../helpers/sortedTupleArray"
import { InMemoryStorage, InMemoryTransaction } from "./InMemoryStorage"
import { MIN, ScanArgs, Storage, Tuple, Value, Writes } from "./types"

type Callback = (write: Writes) => void

export class ListenerStorage<T extends Value> {
	constructor(private storage: Storage) {}

	addListener(index: string, args: ScanArgs, value: T) {
		const bounds = getBounds(args)
		const prefix = getScanPrefix(bounds)

		this.storage
			.transact()
			.set("listeners", [index, prefix, { value, bounds }])
			.commit()

		const unsubscribe = () => {
			this.storage
				.transact()
				.remove("listeners", [index, prefix, { value, bounds }])
				.commit()
		}

		return unsubscribe
	}

	getListeners(index: string, tuple: Tuple) {
		const values: Array<T> = []

		for (let i = 0; i < tuple.length; i++) {
			const prefix = tuple.slice(0, i)
			const results = this.storage.scan("listeners", {
				gte: [index, prefix],
				lt: [index, [...prefix, MIN]],
			})
			for (const result of results) {
				const { value, bounds } = result[result.length - 1] as {
					value: T
					bounds: Bounds
				}
				if (isWithinBounds(tuple, bounds)) {
					values.push(value)
				} else {
					// TODO: track how in-efficient listeners are here.
				}
			}
		}

		return values
	}
}

export class ReactiveStorage implements Storage {
	debug = false

	constructor(private storage: Storage) {}

	private callbacks: { [id: string]: Callback } = {}
	private listeners = new ListenerStorage<string>(new InMemoryStorage())

	private log(...args: any[]) {
		if (this.debug) {
			console.log(...args)
		}
	}

	subscribe(index: string, args: ScanArgs, callack: Callback) {
		this.log("db/subscribe", index, args)

		// Save the callback function for later.
		const id = randomId()
		this.callbacks[id] = callack

		const removeListener = this.listeners.addListener(index, args, id)

		const unsubscribe = () => {
			this.log("db/unsubscribe", index, args)
			delete this.callbacks[id]
			removeListener()
		}

		// Run the query.
		return [this.storage.scan(index, args), unsubscribe] as const
	}

	scan(index: string, args: ScanArgs = {}) {
		this.log("db/scan", index, args)
		return this.storage.scan(index, args)
	}

	transact() {
		return new InMemoryTransaction({
			scan: (...args) => this.scan(...args),
			commit: (...args) => this.commit(...args),
		})
	}

	commit(writes: Writes) {
		this.log("db/commit", writes)
		const updates: { [callbackId: string]: Writes } = {}

		for (const [index, indexWrite] of Object.entries(writes)) {
			const setUpdates = this.fanout(index, indexWrite.sets)
			const removeUpdates = this.fanout(index, indexWrite.removes)
			for (const [callbackId, sets] of Object.entries(setUpdates)) {
				if (!updates[callbackId]) {
					updates[callbackId] = { [index]: { sets, removes: [] } }
				} else if (!updates[callbackId][index]) {
					updates[callbackId][index] = { sets, removes: [] }
				} else {
					updates[callbackId][index].sets.push(...sets)
				}
			}
			for (const [callbackId, removes] of Object.entries(removeUpdates)) {
				if (!updates[callbackId]) {
					updates[callbackId] = { [index]: { sets: [], removes } }
				} else if (!updates[callbackId][index]) {
					updates[callbackId][index] = { sets: [], removes }
				} else {
					updates[callbackId][index].removes.push(...removes)
				}
			}
		}

		this.storage.commit(writes)

		for (const [callbackId, write] of Object.entries(updates)) {
			const callback = this.callbacks[callbackId]
			if (callback) {
				// In theory, all of these callbackIds exist at the beginning of this loop,
				// but it's possible that some of these callbacks causes other subscriptions
				// to unsubscribe that would otherwise get an update in a future iteration
				// of this loop. Thus we have to nullcheck.
				callback(write)
			}
		}
	}

	private fanout(index: string, tuples: Array<Tuple>) {
		const updates: { [callbackId: string]: Array<Tuple> } = {}
		for (const tuple of tuples) {
			const ids = this.listeners.getListeners(index, tuple)
			for (const id of ids) {
				if (!updates[id]) {
					updates[id] = [tuple]
				} else {
					updates[id].push(tuple)
				}
			}
		}
		return updates
	}
}

function getScanPrefix(bounds: Bounds) {
	// Compute the common prefix.
	const prefix: Array<Value> = []
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
