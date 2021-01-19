// This codec is should create a component-wise lexicographically sortable array.

import { invert, isPlainObject } from "lodash"
import * as elen from "elen"
import { MIN, MAX, Value, Tuple } from "../storage/types"
import { compare } from "./compare"

export type Encoding<T> = {
	byte: string
	is(value: unknown): boolean
	encode(value: T): string
	decode(value: string): T
}

export class Encoder<T> {
	private encodingList: Array<Encoding<T>> = []
	private encodingMap: Record<string, Encoding<T>> = {}
	add<E extends T>(encoding: Encoding<E>) {
		this.encodingList.push(encoding)
		this.encodingMap[encoding.byte] = encoding
	}
	encode(obj: T): string {
		for (const encoding of this.encodingList) {
			if (encoding.is(obj)) {
				return encoding.byte + encoding.encode(obj)
			}
		}
		throw new Error("Could not encode: " + obj)
	}
	decode(str: string): T {
		const byte = str[0]
		const rest = str.slice(1)
		const encoding = this.encodingMap[byte]
		if (!encoding) {
			throw new Error("Could find encoding for byte: " + byte)
		}
		return encoding.decode(rest)
	}
}

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

const maxEnc: Encoding<typeof MAX> = {
	byte: encodeType.MAX,
	is: (value) => value === MAX,
	encode(value) {
		return ""
	},
	decode(value) {
		return MAX
	},
}

const minEnc: Encoding<typeof MIN> = {
	byte: encodeType.MIN,
	is: (value) => value === MIN,
	encode(value) {
		return ""
	},
	decode(value) {
		return MIN
	},
}

const nullEnc: Encoding<null> = {
	byte: encodeType.null,
	is: (value) => value === null,
	encode(value) {
		return ""
	},
	decode(value) {
		return null
	},
}

const stringEnv: Encoding<string> = {
	byte: encodeType.string,
	is: (value) => typeof value === "string",
	encode(value) {
		return value
	},
	decode(value) {
		return value
	},
}

const numberEnv: Encoding<number> = {
	byte: encodeType.number,
	is: (value) => typeof value === "number",
	encode(value) {
		return elen.encode(value)
	},
	decode(value) {
		return elen.decode(value)
	},
}

const booleanEnv: Encoding<boolean> = {
	byte: encodeType.boolean,
	is: (value) => value === true || value === false,
	encode(value) {
		return value.toString()
	},
	decode(value) {
		if (value === "true") {
			return true
		}
		if (value === "false") {
			return false
		}
		throw new Error(`Failed parse boolean: ${value}`)
	},
}

const arrayEnv: Encoding<Array<any>> = {
	byte: encodeType.array,
	is: (value) => Array.isArray(value),
	encode(value) {
		return encodeTuple(value)
	},
	decode(value) {
		return decodeTuple(value)
	},
}

const objectEnv: Encoding<{ [key: string]: any }> = {
	byte: encodeType.object,
	is: (value) => isPlainObject(value),
	encode(value) {
		return encodeObjectValue(value)
	},
	decode(value) {
		return decodeObjectValue(value)
	},
}

// array
// object

// Generalize this so its extensible.
// - Date -> date type.
// - Id -> uuid type.

// Generalize this so its extensible.
// - Date -> date type.
// - Id -> uuid type.

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

const decodeType = invert(encodeType) as {
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
		return decodeTuple(rest)
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

function encodeObjectValue(obj: { [key: string]: Value | undefined }) {
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
