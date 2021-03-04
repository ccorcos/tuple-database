import { getBounds, Bounds, isWithinBounds } from "../helpers/sortedTupleArray"
import { MIN, ScanArgs, Storage, Tuple, Value } from "./types"

/**
 * Creates and stores listeners based on the scan prefix.
 */
export class ListenerStorage<T extends Value> {
	constructor(private storage: Storage, private indexName: string) {}

	addListener(index: string, args: ScanArgs, listener: T) {
		const bounds = getBounds(args)
		const prefix = getScanPrefix(bounds)

		this.storage
			.transact()
			.set(this.indexName, [index, prefix, { listener, bounds }])
			.commit()

		const unsubscribe = () => {
			this.storage
				.transact()
				.remove(this.indexName, [index, prefix, { listener, bounds }])
				.commit()
		}

		return unsubscribe
	}

	getListeners(index: string, tuple: Tuple) {
		const listeners: Array<T> = []

		for (let i = 0; i < tuple.length; i++) {
			const prefix = tuple.slice(0, i)
			const results = this.storage.scan(this.indexName, {
				gte: [index, prefix],
				lt: [index, [...prefix, MIN]],
			})
			for (const result of results) {
				const { listener, bounds } = result[result.length - 1] as {
					listener: T
					bounds: Bounds
				}
				if (isWithinBounds(tuple, bounds)) {
					listeners.push(listener)
				} else {
					// TODO: track how in-efficient listeners are here.
				}
			}
		}

		return listeners
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
