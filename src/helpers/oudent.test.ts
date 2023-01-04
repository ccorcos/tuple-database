import assert from "assert"
import { describe, test } from "mocha"
import { outdent } from "./outdent"

describe("outdent", () => {
	test("works", () => {
		const actual = outdent(`
      ReadWriteConflictError
      Write to tuple
      conflicted with a read at the bounds
    `)

		const expected = `ReadWriteConflictError
Write to tuple
conflicted with a read at the bounds`

		assert.strictEqual(actual, expected)
	})

	test("only trims the minimum indent across all the lines", () => {
		// First line is indented only one tab
		const actual = outdent(`
  ReadWriteConflictError
      Write to tuple
      conflicted with a read at the bounds
    `)

		const expected = `ReadWriteConflictError
    Write to tuple
    conflicted with a read at the bounds`

		assert.strictEqual(actual, expected)
	})
})
