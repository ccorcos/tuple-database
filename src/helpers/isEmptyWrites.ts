import { Writes } from "../storage/types"

export function isEmptyWrites(writes: Writes) {
	if (writes.remove?.length) return false
	if (writes.set?.length) return false
	return true
}
