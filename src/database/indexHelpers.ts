import { Tuple, ScanArgs, MIN, MAX } from "./types"
import { binarySearch } from "../helpers/binarySearch"
import { compareTuple } from "./compareTuple"
import { setFlagsFromString } from "v8"

export function set(data: Array<Tuple>, tuple: Tuple) {
	const result = binarySearch(data, tuple, compareTuple)
	if (result.closest !== undefined) {
		// Insert at missing index.
		data.splice(result.closest, 0, tuple)
	}
}

export function remove(data: Array<Tuple>, tuple: Tuple) {
	let { found } = binarySearch(data, tuple, compareTuple)
	if (found !== undefined) {
		// Remove from index.
		data.splice(found, 1)
	}
}

/**
 * Gets the tuple bounds taking into account any prefix specified.
 */
export function getBounds(args: ScanArgs) {
	let gte: Tuple | undefined
	let gt: Tuple | undefined
	let lte: Tuple | undefined
	let lt: Tuple | undefined

	if (args.gte) {
		if (args.prefix) {
			gte = [...args.prefix, ...args.gte]
		} else {
			gte = [...args.gte]
		}
	} else if (args.gt) {
		if (args.prefix) {
			gt = [...args.prefix, ...args.gt]
		} else {
			gt = [...args.gt]
		}
	} else if (args.prefix) {
		gte = [...args.prefix, MIN]
	}

	if (args.lte) {
		if (args.prefix) {
			lte = [...args.prefix, ...args.lte]
		} else {
			lte = [...args.lte]
		}
	} else if (args.lt) {
		if (args.prefix) {
			lt = [...args.prefix, ...args.lt]
		} else {
			lt = [...args.lt]
		}
	} else if (args.prefix) {
		lte = [...args.prefix, MAX]
	}
	return { gte, gt, lte, lt }
}

export function scan(data: Array<Tuple>, args: ScanArgs = {}) {
	const bounds = getBounds(args)
	const start: Tuple | undefined = bounds.gte || bounds.gt
	const end: Tuple | undefined = bounds.lte || bounds.lt

	if (start && end && compareTuple(start, end) > 0) {
		throw new Error("Invalid bounds.")
	}

	// Start at lower bound.
	const result = binarySearch(data, start || [], compareTuple)
	let i =
		result.found !== undefined
			? bounds.gt
				? result.found + 1
				: result.found
			: result.closest

	const results: Array<Tuple> = []
	while (true) {
		// End of array.
		if (i >= data.length) {
			break
		}
		if (args.limit && results.length >= args.limit) {
			// Limit condition.
			break
		}
		// Upper bound condition.
		const tuple = data[i]

		if (bounds.lt) {
			const dir = compareTuple(tuple, bounds.lt)
			if (dir >= 0) {
				break
			}
		}
		if (bounds.lte) {
			const dir = compareTuple(tuple, bounds.lte)
			if (dir > 0) {
				break
			}
		}
		results.push(tuple)
		i += 1
	}
	return results
}
