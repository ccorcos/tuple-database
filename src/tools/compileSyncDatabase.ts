/*

	./node_modules/.bin/ts-node src/tools/compileSyncDatabase.ts

*/

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

const rootPath = path.resolve(__dirname, "../..")

function convert(inputPath: string, outputPath: string) {
	let contents = fs.readFileSync(inputPath, "utf8")

	contents = contents.replace(
		/AsyncTupleStorage \| TupleStorage/g,
		"TupleStorage"
	)
	contents = contents.replace(
		/TupleStorage \| AsyncTupleStorage/g,
		"TupleStorage"
	)

	contents = contents.replace(/[Aa]sync/g, "")
	contents = contents.replace(/await/g, "")
	contents = contents.replace(/Promise<([^>]+)>/g, "$1")

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

convert(
	path.join(rootPath, "src/storage/AsyncTupleDatabase.ts"),
	path.join(rootPath, "src/storage/TupleDatabase.ts")
)
