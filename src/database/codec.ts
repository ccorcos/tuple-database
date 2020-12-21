// This codec is should create a component-wise lexicographically sortable array.
// TODO: for another time, handle variable sort directions for the tuple encoding.

import * as _ from "lodash"
import * as elen from "elen"
import { MIN, MAX, Value, Tuple } from "./types"
import { compare } from "../helpers/compare"

// MIN < null < object < array < number < string < boolean < MAX
const encodeType = {
	MAX: "z",
	boolean: "g",
	string: "f",
	number: "e",
	array: "d",
	object: "c",
	null: "b",
	MIN: "a",
} as const

export function encodeValue(value: Value) {
	if (value === MAX) {
		return encodeType.MAX
	}
	if (value === MIN) {
		return encodeType.MIN
	}
	if (value === null) {
		return encodeType.null
	}
	if (value === true || value === false) {
		return encodeType.boolean + value
	}
	if (typeof value === "string") {
		return encodeType.string + value
	}
	if (typeof value === "number") {
		return encodeType.number + elen.encode(value)
	}
	if (Array.isArray(value)) {
		return encodeType.array + encodeTuple(value)
	}
	if (typeof value === "object") {
		return encodeType.object + encodeObjectValue(value)
	}
	throw new Error("Unknow value type: " + typeof value)
}

const decodeType = _.invert(encodeType) as {
	[key: string]: keyof typeof encodeType
}

export function decodeValue(str: string): Value {
	const encoding = decodeType[str[0]]
	const rest = str.slice(1)

	if (encoding === "MAX") {
		return MAX
	}
	if (encoding === "MIN") {
		return MIN
	}
	if (encoding === "null") {
		return null
	}
	if (encoding === "boolean") {
		return JSON.parse(rest)
	}
	if (encoding === "string") {
		return rest
	}
	if (encoding === "number") {
		return elen.decode(rest)
	}
	if (encoding === "array") {
		return decodeTuple(rest) as Tuple // TODO: this is weird.
	}
	if (encoding === "object") {
		return decodeObjectValue(rest)
	}
	throw new Error("Invalid encoding: " + encoding)
}

export function encodeTuple(tuple: Tuple) {
	return tuple
		.map((value, i) => {
			const encoded = encodeValue(value)
			return (
				encoded
					// B -> BB
					.replace(/\x01/g, "\x01\x01")
					// A -> BA
					.replace(/\x00/g, "\x01\x00") + "\x00"
			)
		})
		.join("")
}

export function decodeTuple(str: string) {
	if (str === "") {
		return []
	}
	// Capture all of the escaped BB and BA pairs and wait
	// til we find an exposed A.
	const re = /(\x01(\x01|\x00)|\x00)/g
	const tuple: Tuple = []
	let start = 0
	while (true) {
		const match = re.exec(str)
		if (match === null) {
			return tuple
		}
		if (match[0][0] === "\x01") {
			// If we match a \x01\x01 or \x01\x00 then keep going.
			continue
		}
		const end = match.index
		const escaped = str.slice(start, end)
		const unescaped = escaped
			// BB -> B
			.replace(/\x01\x01/g, "\x01")
			// BA -> A
			.replace(/\x01\x00/g, "\x00")
		const decoded = decodeValue(unescaped)
		tuple.push(decoded)
		// Skip over the \x00.
		start = end + 1
	}
}

function encodeObjectValue(obj: { [key: string]: Value }) {
	const entires = Object.entries(obj).sort(([k1], [k2]) => compare(k1, k2))
	return encodeTuple(entires as Tuple)
}

function decodeObjectValue(str: string) {
	const entries = decodeTuple(str) as Array<[string, Value]>
	const obj = {}
	for (const [key, value] of entries) {
		obj[key] = value
	}
	return obj
}
