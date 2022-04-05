/*

This file is generated from async/AsyncTupleDatabase.ts

*/

type Identity<T> = T

import { afterMaybePromise } from "../../helpers/afterMaybePromise"
import { isEmptyWrites } from "../../helpers/isEmptyWrites"
import { iterateWrittenTuples } from "../../helpers/iterateTuples"
import { randomId } from "../../helpers/randomId"
import { KeyValuePair, ScanStorageArgs, Writes } from "../../storage/types"
import { ConcurrencyLog } from "../ConcurrencyLog"
import { TupleStorageApi } from "../sync/types"
import { TxId, Unsubscribe } from "../types"
import { ReactivityTracker } from "./ReactivityTracker"
import { Callback, TupleDatabaseApi } from "./types"

export class TupleDatabase implements TupleDatabaseApi {
	constructor(private storage: TupleStorageApi) {}

	log = new ConcurrencyLog()
	reactivity = new ReactivityTracker()

	scan(args: ScanStorageArgs = {}, txId?: TxId): Identity<KeyValuePair[]> {
		const { reverse, limit, ...bounds } = args
		if (txId) this.log.read(txId, bounds)
		return this.storage.scan({ ...bounds, reverse, limit })
	}

	subscribe(args: ScanStorageArgs, callback: Callback): Identity<Unsubscribe> {
		return this.reactivity.subscribe(args, callback)
	}

	private emitting = false

	commit(writes: Writes, txId?: string) {
		// Note: commit is called for transactional reads as well!
		if (this.emitting && !isEmptyWrites(writes))
			throw new Error("No writing during an emit.")

		const emits = this.reactivity.computeReactivityEmits(writes)

		if (txId) this.log.commit(txId)
		for (const tuple of iterateWrittenTuples(writes)) {
			this.log.write(txId, tuple)
		}
		this.storage.commit(writes)

		this.emitting = true
		// Callbacks recieve a txId so we only need to recompute once for a single transaction
		// when there might be multiple listeners fired at the same time.
		return afterMaybePromise(
			this.reactivity.emit(emits, txId || randomId()),
			() => {
				this.emitting = false
			}
		)
	}

	cancel(txId: string) {
		this.log.cancel(txId)
	}

	close() {
		this.storage.close()
	}
}
