import { randomId } from "../helpers/randomId"
import { InMemoryStorage, InMemoryTransaction } from "./InMemoryStorage"
import { ListenerStorage } from "./ListenerStorage"
import { ScanArgs, Storage, Tuple, Writes } from "./types"

/*

// Middleware idea...
// - transactions build up writes and call `commit()` to flush to parent storage.
// - indexers run immediately upon write (not commit).
// - callbacks run

const storage = new SQLiteStorage(sqlite("app.db"))

// Flush every 2 seconds, or we can build up these changes and commit manually.
const transaction = new Transaction(storage)
setInterval(() => transaction.commit(), 2000)

// Update eav indexes and query indexes.
const tripleStorage = new TripleStorage(transaction)




const indexedStorage = {
	...storage,
	// TODO: reactive transaction?
	commit() {
		for (const write of writes) {
			if (write.index === "eav") {
				writes.add("ave", [a,v,e])
				writes.add("vea", [v,e,a])
				writes.add("vae", [v,a,e])
			}
		}
		storage.commit(writes)
	}
}

*/

type Callback = (write: Writes) => void

export class ReactiveStorage implements Storage {
	debug = false

	constructor(private storage: Storage) {}

	private callbacks: { [id: string]: Callback } = {}
	private listeners = new ListenerStorage<string>(
		new InMemoryStorage(),
		"listeners"
	)

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
