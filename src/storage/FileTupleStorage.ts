import * as fs from "fs-extra"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { TupleValuePair, Writes } from "./types"

function parseFile(str: string): TupleValuePair[] {
	if (str === "") {
		return []
	}
	return str.split("\n").map((line) => JSON.parse(line))
}

function serializeFile(data: TupleValuePair[]) {
	return data.map((pair) => JSON.stringify(pair)).join("\n")
}

export class FileTupleStorage extends InMemoryTupleStorage {
	cache: FileCache

	// This is pretty bonkers: https://github.com/Microsoft/TypeScript/issues/8277
	// @ts-ignore
	constructor(public dbPath: string) {
		const cache = new FileCache(dbPath)
		super(cache.get())
		this.cache = cache
	}

	commit(writes: Writes) {
		super.commit(writes)
		this.cache.set(this.data)
	}
}

class FileCache {
	constructor(private dbPath: string) {}

	private getFilePath() {
		return this.dbPath + ".txt"
	}

	get() {
		// Check that the file exists.
		const filePath = this.getFilePath()
		try {
			const stat = fs.statSync(filePath)
			if (!stat.isFile()) {
				throw new Error("Database is not a file.")
			}
		} catch (error) {
			if (error.code === "ENOENT") {
				// File does not exist.
				return []
			}
			throw error
		}

		const fileContents = fs.readFileSync(filePath, "utf8")
		const data = parseFile(fileContents)
		return data
	}

	// TODO: throttle this call if it makes sense.
	set(data: TupleValuePair[]) {
		const filePath = this.getFilePath()
		const fileContents = serializeFile(data)
		fs.mkdirpSync(this.dbPath)
		fs.writeFileSync(filePath, fileContents, "utf8")
	}
}
