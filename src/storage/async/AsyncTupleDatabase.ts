import { iterateWrittenTuples } from "../../helpers/iterateTuples"
import { ConcurrencyLog } from "../ConcurrencyLog"
import { ReactivityTracker } from "../reactivityHelpers"
import { TupleStorageApi } from "../sync/types"
import {
	Callback,
	ScanStorageArgs,
	TupleValuePair,
	TxId,
	Unsubscribe,
	Writes,
} from "../types"
import { AsyncTupleDatabaseApi, AsyncTupleStorageApi } from "./asyncTypes"

export class AsyncTupleDatabase implements AsyncTupleDatabaseApi {
	constructor(private storage: TupleStorageApi | AsyncTupleStorageApi) {}

	log = new ConcurrencyLog()
	reactivity = new ReactivityTracker()

	async scan(
		args: ScanStorageArgs = {},
		txId?: TxId
	): Promise<TupleValuePair[]> {
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

	async commit(writes: Writes, txId?: string) {
		const emits = this.reactivity.computeReactivityEmits(writes)

		if (txId) this.log.commit(txId)
		for (const tuple of iterateWrittenTuples(writes)) {
			this.log.write(txId, tuple)
		}
		await this.storage.commit(writes)

		this.reactivity.emit(emits)
	}

	async cancel(txId: string) {
		this.log.cancel(txId)
	}

	async close() {
		await this.storage.close()
	}
}
