import * as p from "parsimmon"
import { Value } from "../database/storage"

export function exact<T extends string>(str: T) {
	return p.string(str) as p.Parser<T>
}

export const RawStringParser = p.regex(/[a-zA-Z][a-zA-Z0-9\-_]*/)

export const QuotedStringParser = p<string>(function(input, start) {
	const boundaryChar = '"'
	const escapeChar = "\\"
	if (input.charAt(start) !== boundaryChar) {
		return p.makeFailure(start, `Doesn't start with ${boundaryChar}`)
	}

	let end = start + 1
	while (end < input.length) {
		if (input.charAt(end) === escapeChar) {
			end += 2
		} else if (input.charAt(end) === boundaryChar) {
			end += 1
			return p.makeSuccess<string>(end, JSON.parse(input.slice(start, end)))
		} else {
			end += 1
		}
	}

	return p.makeFailure(end, `Could not find matching ${boundaryChar}`)
})

export const NumberParser = p.regex(/[0-9\.\_\-\+e]+/).chain(str => {
	const n = parseFloat(str.replace(/_/g, ""))
	if (isNaN(n)) {
		return p.fail(`Could not parse number ${str}`)
	} else {
		return p.succeed(n)
	}
})

export const BooleanParser = p.alt(
	exact("true").map(() => true),
	exact("false").map(() => false)
)

export const ValueParser = p.alt<Value>(
	QuotedStringParser,
	NumberParser,
	BooleanParser,
	RawStringParser
)
