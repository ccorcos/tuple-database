import * as fs from "fs-extra"
import { rootPath } from "../helpers/rootPath"
import { it } from "mocha"
import assert from "assert"

function exists(path: string) {
	try {
		fs.statSync(path)
		return true
	} catch {
		return false
	}
}

const shouldUpdateSnapshots =
	process.env.UPDATE || process.argv.includes("--update")

export function equalsSnapshot(title: string, value: string) {
	const path = rootPath("src/test/snapshots", title + ".txt")
	if (shouldUpdateSnapshots) {
		fs.writeFileSync(path, value, "utf8")
	} else {
		if (!exists(path)) {
			throw new Error("Missing snapshot. Generate with --update flag.")
		}
		const expected = fs.readFileSync(path, "utf8")
		assert.equal(value, expected)
	}
}

export function snapshotTest(name: string, fn: () => any) {
	it(name, function() {
		const title = this.test!.fullTitle().replace(/\//g, "-")
		const result = fn()
		equalsSnapshot(title, result)
	})
}
