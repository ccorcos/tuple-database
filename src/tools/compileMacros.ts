/*

	./node_modules/.bin/ts-node src/tools/compileMacros.ts

*/

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

const rootPath = path.resolve(__dirname, "../..")

function convertAsyncToSync(inputPath: string, outputPath: string) {
	console.log(
		path.relative(rootPath, inputPath),
		"->",
		path.relative(rootPath, outputPath)
	)

	let contents = fs.readFileSync(inputPath, "utf8")

	// Collapse union types.
	contents = contents.replace(
		/AsyncTupleStorage \| TupleStorage/g,
		"TupleStorage"
	)
	contents = contents.replace(
		/TupleStorage \| AsyncTupleStorage/g,
		"TupleStorage"
	)

	// Maintain camelcase
	contents = contents.replace(/async(.)/g, (x) => x.toLowerCase())

	// Remove async
	contents = contents.replace(/[Aa]sync/g, "")
	contents = contents.replace(/await/g, "")
	contents = contents.replace(/Promise<([^>]+)>/g, "$1")

	// Sync test assertions.
	contents = contents.replace(/assert\.rejects/g, "assert.throws")

	contents = `
/*

This file is generated from ${path.parse(inputPath).base}

*/
${contents}
`

	fs.writeFileSync(outputPath, contents)
	execSync(
		path.join(rootPath, "node_modules/.bin/organize-imports-cli") +
			" " +
			outputPath
	)
	execSync(
		path.join(rootPath, "node_modules/.bin/prettier") + " --write " + outputPath
	)
}

convertAsyncToSync(
	path.join(rootPath, "src/storage/AsyncTupleDatabase.ts"),
	path.join(rootPath, "src/storage/TupleDatabase.ts")
)

convertAsyncToSync(
	path.join(rootPath, "src/test/asyncStorageTestSuite.ts"),
	path.join(rootPath, "src/test/storageTestSuite.ts")
)

convertAsyncToSync(
	path.join(rootPath, "src/storage/ReactiveAsyncTupleDatabase.ts"),
	path.join(rootPath, "src/storage/ReactiveTupleDatabase.ts")
)

convertAsyncToSync(
	path.join(rootPath, "src/storage/ReactiveAsyncTupleDatabase.test.ts"),
	path.join(rootPath, "src/storage/ReactiveTupleDatabase.test.ts")
)
