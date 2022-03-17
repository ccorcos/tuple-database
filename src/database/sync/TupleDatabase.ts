/*

This file is generated from async/AsyncTupleDatabase.ts

*/

type Identity<T> = T

import { iterateWrittenTuples } from "../../helpers/iterateTuples"
import { ScanStorageArgs, TupleValuePair, Writes } from "../../storage/types"
import { ConcurrencyLog } from "../ConcurrencyLog"
import { ReactivityTracker } from "../reactivityHelpers"
import { TupleStorageApi } from "../sync/types"
import { Callback, TxId, Unsubscribe } from "../types"
import { TupleDatabaseApi } from "./types"

export class TupleDatabase implements TupleDatabaseApi {
	constructor(private storage: TupleStorageApi) {}

	log = new ConcurrencyLog()
	reactivity = new ReactivityTracker()

	scan(args: ScanStorageArgs = {}, txId?: TxId): Identity<TupleValuePair[]> {
		const { reverse, limit, ...bounds } = args
		if (txId) this.log.read(txId, bounds)
		return this.storage.scan({ ...bounds, reverse, limit })
	}

	subscribe(args: ScanStorageArgs, callback: Callback): Identity<Unsubscribe> {
		return this.reactivity.subscribe(args, callback)
	}

	commit(writes: Writes, txId?: string) {
		const emits = this.reactivity.computeReactivityEmits(writes)

		if (txId) this.log.commit(txId)
		for (const tuple of iterateWrittenTuples(writes)) {
			this.log.write(txId, tuple)
		}
		this.storage.commit(writes)

		this.reactivity.emit(emits)
	}

	cancel(txId: string) {
		this.log.cancel(txId)
	}

	close() {
		this.storage.close()
	}
}
