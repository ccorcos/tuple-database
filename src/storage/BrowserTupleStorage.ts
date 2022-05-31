import { TupleStorageApi } from "../database/sync/types"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { Writes } from "./types"

function load(key: string) {
	const result = localStorage.getItem(key)
	if (!result) return
	try {
		return JSON.parse(result)
	} catch (error) {}
}

function save(key: string, value: any) {
	localStorage.setItem(key, JSON.stringify(value))
}

export class BrowserStorage
	extends InMemoryTupleStorage
	implements TupleStorageApi
{
	constructor(public localStorageKey: string) {
		super(load(localStorageKey))
	}

	commit(writes: Writes): void {
		super.commit(writes)
		save(this.localStorageKey, this.data)
	}
}
