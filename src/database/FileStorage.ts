import * as p from "parsimmon"
import * as _ from "lodash"
import * as fs from "fs-extra"
import * as path from "path"
import { Value, Tuple, Index } from "./storage"
import { Storage, ScanArgs } from "./storage"
import { InMemoryTransaction } from "./InMemoryStorage"
import { scan, remove, set } from "./indexHelpers"

function exact<T extends string>(str: T) {
	return p.string(str) as p.Parser<T>
}

const StringParser = p<string>(function(input, start) {
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

const NumberParser = p.regex(/[0-9\.\_\-\+e]+/).chain(str => {
	const n = parseFloat(str.replace(/_/g, ""))
	if (isNaN(n)) {
		return p.fail(`Could not parse number ${str}`)
	} else {
		return p.succeed(n)
	}
})

const BooleanParser = p.alt(
	exact("true").map(() => true),
	exact("false").map(() => false)
)

const ValueParser = p.alt<Value>(StringParser, NumberParser, BooleanParser)

const valueSeparator = " "
const TupleParser = p.sepBy1(ValueParser, exact(valueSeparator))

const tupleSeparator = "\n"
const FileParser = p.sepBy(TupleParser, exact(tupleSeparator))

function parseFile(str: string): Array<Tuple> {
	const result = FileParser.parse(str)
	if (result.status === true) {
		return result.value
	} else {
		throw new Error(
			"Failed to parse index.\n" + JSON.stringify(result, null, 2)
		)
	}
}

function serializeValue(value: Value) {
	return JSON.stringify(value)
}

function serializeTuple(tuple: Tuple) {
	return tuple.map(serializeValue).join(valueSeparator)
}

function serializeFile(data: Array<Tuple>) {
	return data.map(serializeTuple).join(tupleSeparator)
}

export class FileStorage implements Storage {
	cache: FileCache
	constructor(private dbPath: string) {
		this.cache = new FileCache(dbPath)
	}

	scan(index: Index, args: ScanArgs = {}): Array<Tuple> {
		const data = this.cache.get(index.name)
		return scan(index.sort, data, args)
	}

	transact() {
		return new InMemoryTransaction({
			scan: (index, args) => this.scan(index, args),
			commit: writes => {
				Object.entries(writes).map(([name, { sets, removes, sort }]) => {
					const data = this.cache.get(name)
					// TODO: more efficent merge.
					for (const tuple of removes) {
						remove(sort, data, tuple)
					}
					for (const tuple of sets) {
						set(sort, data, tuple)
					}
					this.cache.set(name, data)
				})
			},
		})
	}
}

class FileCache {
	constructor(private dbPath: string) {}

	// cache: { [indexName: string]: Array<Tuple>  } = {}

	private initialize = _.once(() => {
		fs.mkdirpSync(this.dbPath)
	})

	private getFilePath(indexName: string) {
		const ext = ".txt"
		return path.join(this.dbPath, indexName + ext)
	}

	get(indexName: string) {
		this.initialize()
		// const cached = this.cache[indexName]
		// if (cached) {
		// 	return cached
		// }

		// Check that the file exists.
		const filePath = this.getFilePath(indexName)
		try {
			const stat = fs.statSync(filePath)
			if (!stat.isFile()) {
				throw new Error("Index is not a file.")
			}
		} catch (error) {
			if (error.code === "ENOENT") {
				// File does not exist.
				return []
			}
			throw error
		}

		const fileContents = fs.readFileSync(filePath, "utf8")
		const tuples = parseFile(fileContents)
		return tuples
	}

	set(indexName: string, tuples: Array<Tuple>) {
		this.initialize()
		const filePath = this.getFilePath(indexName)
		const fileContents = serializeFile(tuples)
		fs.writeFileSync(filePath, fileContents, "utf8")
	}
}
