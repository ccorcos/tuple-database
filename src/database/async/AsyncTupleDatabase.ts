import { iterateWrittenTuples } from "../../helpers/iterateTuples"
import { randomId } from "../../helpers/randomId"
import { KeyValuePair, ScanStorageArgs, Writes } from "../../storage/types"
import { ConcurrencyLog } from "../ConcurrencyLog"
import { ReactivityTracker } from "../reactivityHelpers"
import { TupleStorageApi } from "../sync/types"
import { Callback, TxId, Unsubscribe } from "../types"
import { AsyncTupleDatabaseApi, AsyncTupleStorageApi } from "./asyncTypes"

export class AsyncTupleDatabase implements AsyncTupleDatabaseApi {
	constructor(private storage: TupleStorageApi | AsyncTupleStorageApi) {}

	log = new ConcurrencyLog()
	reactivity = new ReactivityTracker()

	async scan(args: ScanStorageArgs = {}, txId?: TxId): Promise<KeyValuePair[]> {
		const { reverse, limit, ...bounds } = args
		if (txId) this.log.read(txId, bounds)
		return this.storage.scan({ ...bounds, reverse, limit })
	}

	async subscribe(
		args: ScanStorageArgs,
		callback: Callback
	): Promise<Unsubscribe> {
		return this.reactivity.subscribe(args, callback)
	}

	private emitting = false

	async commit(writes: Writes, txId?: string) {
		// Things can get out of sync if you write in a subscribe callback.
		if (this.emitting) throw new Error("Write during emit.")

		const emits = this.reactivity.computeReactivityEmits(writes)

		if (txId) this.log.commit(txId)
		for (const tuple of iterateWrittenTuples(writes)) {
			this.log.write(txId, tuple)
		}
		await this.storage.commit(writes)

		this.emitting = true
		const recomputes = this.reactivity.emit(emits, txId || randomId())
		this.emitting = false

		// If the callbacks are async, they may be recomputing values so its sensible to await
		// those recomputations so we don't have to setTimeout(0) before the updates are reflected
		// from any listeners.
		thing: {
			await Promise.all(recomputes)
		}
	}

	async cancel(txId: string) {
		this.log.cancel(txId)
	}

	async close() {
		await this.storage.close()
	}
}
