import { binarySearch } from "./binarySearch"
import { Compare } from "./compare"

export function set<T>(list: T[], item: T, cmp: Compare<T>) {
	const result = binarySearch(list, item, cmp)
	if (result.closest !== undefined) {
		// Insert at missing index.
		list.splice(result.closest, 0, item)
		return true
	}
	return false
}

export function exists<T>(list: T[], item: T, cmp: Compare<T>) {
	const result = binarySearch(list, item, cmp)
	return result.found !== undefined
}

export function remove<T>(list: T[], item: T, cmp: Compare<T>) {
	let { found } = binarySearch(list, item, cmp)
	if (found !== undefined) {
		// Remove from index.
		list.splice(found, 1)
		return true
	}
	return false
}

export type ScanArgs<T> = {
	gt?: T
	gte?: T
	lt?: T
	lte?: T
	limit?: number
	reverse?: boolean
}

export function scan<T>(list: T[], args: ScanArgs<T>, cmp: Compare<T>) {
	const start = args.gte || args.gt
	const end = args.lte || args.lt

	if (start !== undefined && end !== undefined && cmp(start, end) > 0) {
		throw new Error("Invalid bounds.")
	}

	// Start at lower bound.
	let i: number

	if (args.reverse) {
		if (end === undefined) {
			i = list.length - 1
		} else {
			const result = binarySearch(list, end, cmp)
			if (result.found === undefined) {
				i = result.closest - 1 // i could be -1!
			} else {
				if (args.lt) i = result.found - 1
				else i = result.found
			}
		}
	} else {
		if (start === undefined) {
			i = 0
		} else {
			const result = binarySearch(list, start, cmp)
			if (result.found === undefined) {
				i = result.closest
			} else {
				if (args.gt) i = result.found + 1
				else i = result.found
			}
		}
	}

	const results: T[] = []
	while (true) {
		// End of array.
		if (i >= list.length || i < 0) {
			break
		}
		if (args.limit && results.length >= args.limit) {
			// Limit condition.
			break
		}

		if (args.reverse) {
			// Lower bound condition.
			const item = list[i]

			if (args.gt) {
				const dir = cmp(args.gt, item)
				if (dir >= 0) {
					break
				}
			}
			if (args.gte) {
				const dir = cmp(args.gte, item)
				if (dir > 0) {
					break
				}
			}
			results.push(item)
			i -= 1
		} else {
			// Upper bound condition.
			const item = list[i]

			if (args.lt) {
				const dir = cmp(item, args.lt)
				if (dir >= 0) {
					break
				}
			}
			if (args.lte) {
				const dir = cmp(item, args.lte)
				if (dir > 0) {
					break
				}
			}
			results.push(item)
			i += 1
		}
	}
	return results
}
