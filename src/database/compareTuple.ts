import { Value, Sort } from "./storage"
import { compare } from "../helpers/compare"

export const MIN = Symbol("min")
export const MAX = Symbol("max")

export type QueryValue = Value | typeof MIN | typeof MAX

export type QueryTuple = Array<QueryValue>

// MIN < null < number < string < false < true < MAX
const rank = ["number", "string", "boolean"]

export function compareQueryValue(a: QueryValue, b: QueryValue): number {
	// Check the bounds.
	if (a === MIN) {
		if (b === MIN) {
			return 0
		} else {
			return -1
		}
	} else if (b === MIN) {
		return 1
	} else if (a === MAX) {
		if (b === MAX) {
			return 0
		} else {
			return 1
		}
	} else if (b === MAX) {
		return -1
	}

	// Null is last.
	if (a === null) {
		if (b === null) {
			return 0
		} else {
			return -1
		}
	} else {
		if (b === null) {
			return 1
		}
	}

	const at = typeof a
	const bt = typeof b
	if (at === bt) {
		return compare(a, b)
	}

	return compare(rank.indexOf(at), rank.indexOf(bt))
}

export function compareTuple(sort: Sort) {
	if (sort.length === 0) {
		throw new Error("Sort length 0.")
	}
	return (a: QueryTuple, b: QueryTuple) => {
		if (a.length !== sort.length) {
			throw new Error(`Sort length mismatch. ${JSON.stringify({ a, sort })}`)
		}
		if (b.length !== sort.length) {
			throw new Error(`Sort length mismatch. ${JSON.stringify({ b, sort })}`)
		}
		for (let i = 0; i < sort.length; i++) {
			const dir = compareQueryValue(a[i], b[i])
			if (dir === 0) {
				continue
			}
			return dir * sort[i]
		}
		return 0
	}
}

export function queryValueToString(value: QueryValue) {
	if (value === MIN) {
		return "MIN"
	} else if (value === MAX) {
		return "MAX"
	} else if (value === null) {
		return "null"
	} else {
		return JSON.stringify(value)
	}
}

export function queryTupleToString(tuple: QueryTuple) {
	return `[${tuple.map(queryValueToString).join(",")}]`
}
