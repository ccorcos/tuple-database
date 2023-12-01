// TODO: list query versioning...
// TODO: kv cleanup for deletes...
// - centralized sequencer but then not as good for offline...

/*



*/
type BinarySearchResult =
	| { found: number; closest?: undefined }
	| { found?: undefined; closest: number }

function binarySearch<T>(
	list: Array<T>,
	compare: (a: T) => -1 | 0 | 1
): BinarySearchResult {
	var min = 0
	var max = list.length - 1
	while (min <= max) {
		var k = (max + min) >> 1
		var dir = compare(list[k])
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

function compare<K extends string | number | boolean | Date>(
	a: K,
	b: K
): -1 | 0 | 1 {
	if (a > b) {
		return 1
	}
	if (a < b) {
		return -1
	}
	return 0
}

export class ConflictError extends Error {}

export class OrderedKeyValueDatabase {
	private data: { key: string; value: any; version: number }[] = []

	get = (key: string): { value: any; version: number } => {
		const result = binarySearch(this.data, (a) => compare(a.key, key))
		if (!result.found) return { value: undefined, version: 0 }
		const { value, version } = this.data[result.found]
		return { value, version }
	}

	/**
	 * start is inclusive. end is exclusive. prefix is exclusive
	 */
	list = (args: {
		prefix?: string
		start?: string
		end?: string
		limit?: number
		reverse?: boolean
	}) => {
		let startKey: string | undefined
		let endKey: string | undefined
		if (args.prefix) {
			startKey = args.prefix + "\x00"
			endKey = args.prefix + "\xff"
		}
		if (args.start) {
			startKey = args.start
		}
		if (args.end) {
			const lastChar = String.fromCharCode(
				args.end.charCodeAt(args.end.length - 1) + 1
			)
			endKey = args.end.substring(0, args.end.length - 1) + lastChar
		}

		if (startKey && endKey && compare(startKey, endKey) > 0) {
			throw new Error("Invalid bounds.")
		}

		let startIndex: number = 0
		let endIndex: number = this.data.length - 1

		if (startKey) {
			const _start = startKey
			const result = binarySearch(this.data, (a) => compare(a.key, _start))
			startIndex = result.found !== undefined ? result.found : result.closest
		}

		if (endKey) {
			const _end = endKey
			const result = binarySearch(this.data, (a) => compare(a.key, _end))
			endIndex = result.found !== undefined ? result.found : result.closest
		}

		let list: { key: string; value: any; version: number }[] = []

		if (args.reverse) {
			if (args.limit) {
				list = this.data
					.slice(Math.max(startIndex, endIndex - args.limit), endIndex)
					.reverse()
			} else {
				list = this.data.slice(startIndex, endIndex).reverse()
			}
		} else {
			if (args.limit) {
				list = this.data.slice(
					startIndex,
					Math.min(startIndex + args.limit, endIndex)
				)
			} else {
				list = this.data.slice(startIndex, endIndex)
			}
		}

		return list
	}

	write(tx: {
		check?: { key: string; version: number }[]
		// | { start: string; end: string; version: number }
		set?: { key: string; value: any }[]
		sum?: { key: string; value: number }[]
		min?: { key: string; value: number }[]
		max?: { key: string; value: number }[]
		delete?: (string | { start: string; end: string })[]
	}) {
		for (const { key, version } of tx.check || [])
			if (this.get(key).version !== version)
				throw new ConflictError(`Version check failed. ${key} ${version}`)

		for (const { key, value } of tx.set || []) {
			const result = binarySearch(this.data, (item) => compare(item.key, key))
			if (result.found !== undefined) {
				// Replace the whole item.
				const existing = this.data[result.found]
				this.data.splice(result.found, 1, {
					key,
					value,
					version: existing.version + 1,
				})
			} else {
				// Insert at missing index.
				this.data.splice(result.closest, 0, {
					key,
					value,
					version: 1,
				})
			}
		}

		const numberOperation = (
			key: string,
			value: number,
			op: (a: number, b: number) => number
		) => {
			const result = binarySearch(this.data, (item) => compare(item.key, key))
			if (result.found !== undefined) {
				// Replace the whole item.
				const existing = this.data[result.found]

				let newValue = value
				if (typeof existing.value === "number") {
					newValue = op(value, existing.value)
				} else if (existing.value !== undefined) {
					console.warn(
						"Calling sum on a non-number value:",
						key,
						existing.value
					)
				}
				this.data.splice(result.found, 1, {
					key,
					value: newValue,
					version: existing.version + 1,
				})
			} else {
				// Insert at missing index.
				this.data.splice(result.closest, 0, {
					key,
					value,
					version: 1,
				})
			}
		}

		for (const { key, value } of tx.sum || [])
			numberOperation(key, value, (a, b) => a + b)
		for (const { key, value } of tx.min || [])
			numberOperation(key, value, (a, b) => Math.min(a, b))
		for (const { key, value } of tx.max || [])
			numberOperation(key, value, (a, b) => Math.max(a, b))

		for (const key of tx.delete || []) {
			if (typeof key === "string") {
				const existing = this.map[key]
				if (!existing) continue
				this.map[key] = {
					value: undefined,
					version: existing.version + 1,
				}
			}
		}
	}
}

// itree = {
//   overlaps(start, end): {list: {start, end, key, value, version}[], version},
//   write(tx: {
//     check: {start, end, version}[]
//     set: {key, value}[]
//     delete: key[] | {start, end}[]
//   }): void
// }

// rtree = {...}
