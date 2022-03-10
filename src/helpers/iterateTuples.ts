import { Writes } from "../storage/types"

export function* iterateWrittenTuples(write: Writes) {
	for (const [tuple, _value] of write.set || []) {
		yield tuple
	}
	for (const tuple of write.remove || []) {
		yield tuple
	}
}

export function getWrittenTuples(write: Writes) {
	return Array.from(iterateWrittenTuples(write))
}
