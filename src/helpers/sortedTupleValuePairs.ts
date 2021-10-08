import { ScanArgs, Tuple, TupleValuePair } from "../storage/types"
import { binarySearchAssociativeList } from "./binarySearch"
import { compareTuple } from "./compareTuple"
import { normalizeBounds } from "./sortedTupleArray"

export function set(data: TupleValuePair[], tuple: Tuple, value: any) {
	const result = binarySearchAssociativeList(data, tuple, compareTuple)
	if (result.found !== undefined) {
		// Replace the whole pair.
		data.splice(result.found, 1, [tuple, value])
		return true
	} else if (result.closest !== undefined) {
		// Insert at missing index.
		data.splice(result.closest, 0, [tuple, value])
		return true
	}
	return false
}

export function remove(data: TupleValuePair[], tuple: Tuple) {
	let { found } = binarySearchAssociativeList(data, tuple, compareTuple)
	if (found !== undefined) {
		// Remove from index.
		const pair = data.splice(found, 1)[0]
		return pair
	}
}

export function get(data: TupleValuePair[], tuple: Tuple) {
	const result = binarySearchAssociativeList(data, tuple || [], compareTuple)
	if (result.found === undefined) return
	const pair = data[result.found]
	return pair[1]
}

export function exists(data: TupleValuePair[], tuple: Tuple) {
	const result = binarySearchAssociativeList(data, tuple || [], compareTuple)
	return result.found !== undefined
}

export function scan(data: TupleValuePair[], args: ScanArgs = {}) {
	const bounds = normalizeBounds(args)
	const start: Tuple | undefined = bounds.gte || bounds.gt
	const end: Tuple | undefined = bounds.lte || bounds.lt

	if (start && end && compareTuple(start, end) > 0) {
		throw new Error("Invalid bounds.")
	}

	// Start at lower bound.
	const result = binarySearchAssociativeList(data, start || [], compareTuple)
	let i =
		result.found !== undefined
			? bounds.gt
				? result.found + 1
				: result.found
			: result.closest

	const results: TupleValuePair[] = []
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
		const [tuple, value] = data[i]

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
		results.push([tuple, value])
		i += 1
	}
	return results
}
