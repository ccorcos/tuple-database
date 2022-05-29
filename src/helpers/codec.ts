// This codec is should create a component-wise lexicographically sortable array.

import * as elen from "elen"
import { invert, isPlainObject, sortBy } from "lodash"
import { Tuple, Value } from "../storage/types"
import { compare } from "./compare"
import { UnreachableError } from "./Unreachable"

// null < object < array < number < string < boolean
export const encodingByte = {
	null: "b",
	object: "c",
	array: "d",
	number: "e",
	string: "f",
	boolean: "g",
} as const

export type EncodingType = keyof typeof encodingByte

export const encodingRank = sortBy(
	Object.entries(encodingByte),
	([key, value]) => value
).map(([key]) => key as EncodingType)

export function encodeValue(value: Value) {
	if (value === null) {
		return encodingByte.null
	}
	if (value === true || value === false) {
		return encodingByte.boolean + value
	}
	if (typeof value === "string") {
		return encodingByte.string + value
	}
	if (typeof value === "number") {
		return encodingByte.number + elen.encode(value)
	}
	if (Array.isArray(value)) {
		return encodingByte.array + encodeTuple(value)
	}
	if (typeof value === "object") {
		return encodingByte.object + encodeObjectValue(value)
	}
	throw new UnreachableError(value, "Unknown value type")
}

export function encodingTypeOf(value: Value): EncodingType {
	if (value === null) {
		return "null"
	}
	if (value === true || value === false) {
		return "boolean"
	}
	if (typeof value === "string") {
		return "string"
	}
	if (typeof value === "number") {
		return "number"
	}
	if (Array.isArray(value)) {
		return "array"
	}
	if (typeof value === "object") {
		return "object"
	}
	throw new UnreachableError(value, "Unknown value type")
}

const decodeType = invert(encodingByte) as {
	[key: string]: keyof typeof encodingByte
}

export function decodeValue(str: string): Value {
	const encoding: EncodingType = decodeType[str[0]]
	const rest = str.slice(1)

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
		return decodeTuple(rest)
	}
	if (encoding === "object") {
		return decodeObjectValue(rest)
	}
	throw new UnreachableError(encoding, "Invalid encoding byte")
}

export function encodeTuple(tuple: Tuple) {
	return tuple
		.map((value, i) => {
			const encoded = encodeValue(value)
			return (
				encoded
					// B -> BB or \ -> \\
					.replace(/\x01/g, "\x01\x01")
					// A -> BA or x -> \x
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

function encodeObjectValue(obj: object) {
	if (!isPlainObject(obj)) {
		throw new Error("Cannot serialize this object.")
	}
	const entries = Object.entries(obj)
		.sort(([k1], [k2]) => compare(k1, k2))
		// We allow undefined values in objects, but we want to strip them out before
		// serializing.
		.filter(([key, value]) => value !== undefined)
	return encodeTuple(entries as Tuple)
}

function decodeObjectValue(str: string) {
	const entries = decodeTuple(str) as Array<[string, Value]>
	const obj = {}
	for (const [key, value] of entries) {
		obj[key] = value
	}
	return obj
}
