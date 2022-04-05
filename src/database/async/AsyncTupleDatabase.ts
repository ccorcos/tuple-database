import { afterMaybePromise } from "../../helpers/afterMaybePromise"
import { iterateWrittenTuples } from "../../helpers/iterateTuples"
import { randomId } from "../../helpers/randomId"
import { KeyValuePair, ScanStorageArgs, Writes } from "../../storage/types"
import { ConcurrencyLog } from "../ConcurrencyLog"
import { TupleStorageApi } from "../sync/types"
import { TxId, Unsubscribe } from "../types"
import { AsyncReactivityTracker } from "./AsyncReactivityTracker"
import {
	AsyncCallback,
	AsyncTupleDatabaseApi,
	AsyncTupleStorageApi,
} from "./asyncTypes"

export class AsyncTupleDatabase implements AsyncTupleDatabaseApi {
	constructor(private storage: TupleStorageApi | AsyncTupleStorageApi) {}

	log = new ConcurrencyLog()
	reactivity = new AsyncReactivityTracker()

	async scan(args: ScanStorageArgs = {}, txId?: TxId): Promise<KeyValuePair[]> {
		const { reverse, limit, ...bounds } = args
		if (txId) this.log.read(txId, bounds)
		return this.storage.scan({ ...bounds, reverse, limit })
	}

	async subscribe(
		args: ScanStorageArgs,
		callback: AsyncCallback
	): Promise<Unsubscribe> {
		return this.reactivity.subscribe(args, callback)
	}

	private emitting = false

	async commit(writes: Writes, txId?: string) {
		// Note: commit is called for transactional reads as well!
		// TODO: not sure if this is a good idea...
		// if (this.emitting && !isEmptyWrites(writes))
		// 	throw new Error("No writing during an emit.")

		const emits = this.reactivity.computeReactivityEmits(writes)

		if (txId) this.log.commit(txId)
		for (const tuple of iterateWrittenTuples(writes)) {
			this.log.write(txId, tuple)
		}
		await this.storage.commit(writes)

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

	async cancel(txId: string) {
		this.log.cancel(txId)
	}

	async close() {
		await this.storage.close()
	}
}
