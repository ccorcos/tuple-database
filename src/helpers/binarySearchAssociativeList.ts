import { BinarySearchResult } from "./binarySearch"
import { Compare } from "./compare"

// Binary search an associative array.
export function binarySearchAssociativeList<T>(
	list: [T, any][],
	item: T,
	cmp: Compare<T>
): BinarySearchResult {
	var min = 0
	var max = list.length - 1
	while (min <= max) {
		var k = (max + min) >> 1
		var dir = cmp(item, list[k][0])
		if (dir > 0) {
			min = k + 1
		} else if (dir < 0) {
			max = k - 1
		} else {
			return { found: k }
		}
	}
	return { closest: min }
}
