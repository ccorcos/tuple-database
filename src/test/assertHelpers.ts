import { strict as assert } from "assert"

export { assert }

// A generic version of assert.equal so we can catch equality errors through types
export function assertEqual<T>(actual: T, expected: T, reason?: string) {
	return assert.deepEqual(actual, expected, reason)
}
