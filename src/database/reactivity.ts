import { randomId } from "../helpers/randomId"
import { InMemoryStorage } from "./InMemoryStorage"
import { QueryValue, ScanArgs, Storage, Tuple, Value } from "./types"

type Callback = (tuples: Array<Tuple>) => void

export class ReactiveStorage {
	constructor(private storage: Storage) {}

	private callbacks: { [id: string]: Callback } = {}
	private listeners = new InMemoryStorage()

	subscribe(index: string, args: ScanArgs, callack: Callback) {
		// Save the callback function for later.
		const id = randomId()
		this.callbacks[id] = callack

		const prefix = getScanPrefix(args)
		this.listeners.transact().set("listeners", [prefix, id])
	}
}

function getScanPrefix(args: ScanArgs) {
	// Compute the common prefix.
	const prefix: Array<QueryValue> = []
	const start = args.gt || args.gte || []
	const end = args.lt || args.lte || []
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
