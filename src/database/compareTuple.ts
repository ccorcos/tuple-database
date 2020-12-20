import { Value, Sort } from "./types"
import { compare } from "../helpers/compare"

export const MIN = Symbol("min")
export const MAX = Symbol("max")

export type QueryValue = Value | typeof MIN | typeof MAX

export type QueryTuple = Array<QueryValue>

// MIN < null < object < array < number < string < boolean < MAX
const typeRank = [
	"min",
	"null",
	"object",
	"array",
	"number",
	"string",
	"boolean",
	"max",
]

function typeOf(value: QueryValue) {
	if (value === MAX) {
		return "max"
	}
	if (value === MIN) {
		return "min"
	}
	if (value === null) {
		return "null"
	}
	if (Array.isArray(value)) {
		return "array"
	}
	return typeof value
}

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

	const at = typeOf(a)
	const bt = typeOf(b)
	if (at === bt) {
		if (at === "array") {
			return compareArbitraryTuples(a as any, b as any)
		} else if (at === "object") {
			return compareArbitraryObjects(a as any, b as any)
		} else {
			return compare(a, b)
		}
	}

	return compare(typeRank.indexOf(at), typeRank.indexOf(bt))
}

function compareArbitraryTuples(a: QueryTuple, b: QueryTuple) {
	const len = Math.min(a.length, b.length)

	for (let i = 0; i < len; i++) {
		const dir = compareQueryValue(a[i], b[i])
		if (dir === 0) {
			continue
		}
		return dir
	}

	if (a.length > b.length) {
		return 1
	} else if (a.length < b.length) {
		return -1
	} else {
		return 0
	}
}

function compareArbitraryObjects(
	a: { [key: string]: QueryValue },
	b: { [key: string]: QueryValue }
) {
	const ae = Object.entries(a).sort(([k1], [k2]) => compare(k1, k2))
	const be = Object.entries(b).sort(([k1], [k2]) => compare(k1, k2))

	const len = Math.min(ae.length, be.length)

	for (let i = 0; i < len; i++) {
		const [ak, av] = ae[i]
		const [bk, bv] = be[i]
		const dir = compareQueryValue(ak, bk)
		if (dir === 0) {
			const dir2 = compareQueryValue(av, bv)
			if (dir2 === 0) {
				continue
			}
			return dir2
		}
		return dir
	}

	if (ae.length > be.length) {
		return 1
	} else if (ae.length < be.length) {
		return -1
	} else {
		return 0
	}
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
