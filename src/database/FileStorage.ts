import * as _ from "lodash"
import * as fs from "fs-extra"
import * as path from "path"
import { Value, Tuple, Index, Storage, ScanArgs } from "./types"
import { InMemoryTransaction } from "./InMemoryStorage"
import { scan, remove, set } from "./indexHelpers"
import * as json from "../helpers/json"

function parseFile(str: string): Array<Tuple> {
	return str.split("\n").map((line) => json.parse(line))
}

function serializeFile(data: Array<Tuple>) {
	return data.map((tuple) => json.stringify(tuple)).join("\n")
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
			commit: (writes) => {
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

	private initialize = _.once(() => {
		fs.mkdirpSync(this.dbPath)
	})

	private getFilePath(indexName: string) {
		const ext = ".txt"
		return path.join(this.dbPath, indexName + ext)
	}

	get(indexName: string) {
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
