import { Tuple, Sort, ScanArgs } from "./types"
import { binarySearch } from "../helpers/binarySearch"
import { MAX, MIN, compareTuple, QueryTuple } from "./compareTuple"

export function set(sort: Sort, data: Array<Tuple>, tuple: Tuple) {
	const result = binarySearch(data, tuple, compareTuple(sort))
	if (result.closest !== undefined) {
		// Insert at missing index.
		data.splice(result.closest, 0, tuple)
	}
}

export function remove(sort: Sort, data: Array<Tuple>, tuple: Tuple) {
	let { found } = binarySearch(data, tuple, compareTuple(sort))
	if (found !== undefined) {
		// Remove from index.
		data.splice(found, 1)
	}
}

function getTupleBoundary(
	sort: Sort,
	type: "start" | "startAfter" | "end" | "endBefore",
	tuple: Tuple
) {
	const bound: QueryTuple = [...tuple]
	for (let i = bound.length; i < sort.length; i++) {
		if (type === "startAfter") {
			bound[i] = sort[i] === 1 ? MAX : MIN
		} else if (type === "start") {
			bound[i] = sort[i] === 1 ? MIN : MAX
		} else if (type === "endBefore") {
			bound[i] = sort[i] === 1 ? MIN : MAX
		} else if (type === "end") {
			bound[i] = sort[i] === 1 ? MAX : MIN
		}
	}
	return bound
}

export function getScanBounds(sort: Sort, args: ScanArgs) {
	const start: QueryTuple = args.startAfter
		? getTupleBoundary(sort, "startAfter", args.startAfter)
		: getTupleBoundary(sort, "start", args.start || [])
	const end: QueryTuple = args.endBefore
		? getTupleBoundary(sort, "endBefore", args.endBefore)
		: getTupleBoundary(sort, "end", args.end || [])
	return { start, end }
}

export function scan(sort: Sort, data: Array<Tuple>, args: ScanArgs = {}) {
	const { start, end } = getScanBounds(sort, args)
	const cmp = compareTuple(sort)

	if (cmp(start, end) > 0) {
		throw new Error("Invalid bounds.")
	}

	// Start at lower bound.
	const result = binarySearch(data, start, cmp)
	let i =
		result.found !== undefined
			? args.start
				? result.found
				: result.found + 1
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
		const dir = cmp(tuple, end)
		if (args.endBefore && dir >= 0) {
			break
		}
		if (args.end && dir > 0) {
			break
		}
		results.push(tuple)
		i += 1
	}
	return results
}
