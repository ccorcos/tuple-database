import { Writes } from "../storage/types"

export function* iterateWrittenTuples(write: Writes) {
	for (const { key } of write.set || []) {
		yield key
	}
	for (const tuple of write.remove || []) {
		yield tuple
	}
}

export function getWrittenTuples(write: Writes) {
	return Array.from(iterateWrittenTuples(write))
}
