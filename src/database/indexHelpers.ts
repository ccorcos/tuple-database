import { Tuple, ScanArgs, MAX, MIN, QueryTuple } from "./types"
import { binarySearch } from "../helpers/binarySearch"
import { compareTuple } from "./compareTuple"

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

export function scan(data: Array<Tuple>, args: ScanArgs = {}) {
	const start: QueryTuple | undefined = args.gte || args.gt
	// if (args.gt) {
	// 	start?.push(MAX)
	// }
	const end: QueryTuple | undefined = args.lte || args.lt
	// if (args.lt) {
	// 	end?.push(MIN)
	// }

	if (start && end && compareTuple(start, end) > 0) {
		throw new Error("Invalid bounds.")
	}

	// Start at lower bound.
	const result = binarySearch(data, start || [], compareTuple)
	let i =
		result.found !== undefined
			? args.gt
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

		if (args.lt) {
			const dir = compareTuple(tuple, args.lt)
			if (dir >= 0) {
				break
			}
		}
		if (args.lte) {
			const dir = compareTuple(tuple, args.lte)
			if (dir > 0) {
				break
			}
		}
		results.push(tuple)
		i += 1
	}
	return results
}
