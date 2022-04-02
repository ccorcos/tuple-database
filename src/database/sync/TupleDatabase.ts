/*

This file is generated from async/AsyncTupleDatabase.ts

*/

type Identity<T> = T

import { iterateWrittenTuples } from "../../helpers/iterateTuples"
import { randomId } from "../../helpers/randomId"
import { KeyValuePair, ScanStorageArgs, Writes } from "../../storage/types"
import { ConcurrencyLog } from "../ConcurrencyLog"
import { ReactivityTracker } from "../reactivityHelpers"
import { TupleStorageApi } from "../sync/types"
import { Callback, TxId, Unsubscribe } from "../types"
import { TupleDatabaseApi } from "./types"

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
		// Things can get out of sync if you write in a subscribe callback.
		if (this.emitting) throw new Error("Write during emit.")

		const emits = this.reactivity.computeReactivityEmits(writes)

		if (txId) this.log.commit(txId)
		for (const tuple of iterateWrittenTuples(writes)) {
			this.log.write(txId, tuple)
		}
		this.storage.commit(writes)

		this.emitting = true
		const recomputes = this.reactivity.emit(emits, txId || randomId())
		this.emitting = false

		// If the callbacks are , they may be recomputing values so its sensible to
		// those recomputations so we don't have to setTimeout(0) before the updates are reflected
		// from any listeners.
		thing: {
			recomputes
		}
	}

	cancel(txId: string) {
		this.log.cancel(txId)
	}

	close() {
		this.storage.close()
	}
}
