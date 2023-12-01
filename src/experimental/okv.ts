import { ulid } from "ulid"

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
		var dir = compare(list[k]) * -1
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

function insert<T>(
	value: T,
	list: Array<T>,
	compare: (a: T, b: T) => -1 | 0 | 1
) {
	const result = binarySearch(list, (item) => compare(item, value))
	if (result.found !== undefined) {
		// Replace the whole item.
		list.splice(result.found, 1, value)
	} else {
		// Insert at missing index.
		list.splice(result.closest, 0, value)
	}
}

function replace<T>(
	list: Array<T>,
	compare: (a: T) => -1 | 0 | 1,
	update: (existing?: T) => T
) {
	const result = binarySearch(list, compare)
	if (result.found !== undefined) {
		// Replace the whole item.
		list.splice(result.found, 1, update(list[result.found]))
	} else {
		// Insert at missing index.
		list.splice(result.closest, 0, update())
	}
}

function remove<T>(list: T[], compare: (a: T) => -1 | 0 | 1) {
	let { found } = binarySearch(list, compare)
	if (found !== undefined) {
		// Remove from index.
		return list.splice(found, 1)[0]
	}
}

export class ConflictError extends Error {}

export class OrderedKeyValueDatabase {
	private data: { key: string; value: any; version: string }[] = []

	get = (key: string): { value: any; version: string } | undefined => {
		const result = binarySearch(this.data, (a) => compare(a.key, key))
		if (result.found === undefined) return
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
			endKey = args.end
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

		if (args.reverse) {
			if (!args.limit) return this.data.slice(startIndex, endIndex).reverse()
			return this.data
				.slice(Math.max(startIndex, endIndex - args.limit), endIndex)
				.reverse()
		}

		if (!args.limit) return this.data.slice(startIndex, endIndex)
		return this.data.slice(
			startIndex,
			Math.min(startIndex + args.limit, endIndex)
		)
	}

	write(tx: {
		check?: { key: string; version: string }[]
		// TODO: check range
		set?: { key: string; value: any }[]
		sum?: { key: string; value: number }[]
		min?: { key: string; value: number }[]
		max?: { key: string; value: number }[]
		delete?: string[]
		// TODO: delete range
	}) {
		for (const { key, version } of tx.check || [])
			if (this.get(key)?.version !== version)
				throw new ConflictError(`Version check failed. ${key} ${version}`)

		const version = ulid()

		for (const { key, value } of tx.set || [])
			insert({ key, value, version }, this.data, (a, b) =>
				compare(a.key, b.key)
			)

		const replaceValue = (key: string, update: (existing?: any) => any) =>
			replace(
				this.data,
				(a) => compare(a.key, key),
				(result) => ({ key, version, value: update(result?.value) })
			)

		for (const { key, value } of tx.sum || [])
			replaceValue(key, (existing) => {
				if (typeof existing === "number") return existing + value
				if (existing === undefined) return value
				console.warn("Calling sum on a non-number value:", key, existing)
				return value
			})
		for (const { key, value } of tx.min || [])
			replaceValue(key, (existing) => {
				if (typeof existing === "number") return Math.min(existing, value)
				if (existing === undefined) return value
				console.warn("Calling min on a non-number value:", key, existing)
				return value
			})
		for (const { key, value } of tx.max || [])
			replaceValue(key, (existing) => {
				if (typeof existing === "number") return Math.max(existing, value)
				if (existing === undefined) return value
				console.warn("Calling max on a non-number value:", key, existing)
				return value
			})

		for (const key of tx.delete || [])
			remove(this.data, (a) => compare(a.key, key))
	}
}
