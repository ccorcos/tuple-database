import { randomId } from "../../helpers/randomId"
import {
	Callback,
	ScanArgs,
	Tuple,
	TupleValuePair,
	TxId,
	Unsubscribe,
	Writes,
} from "../types"
import { AsyncTupleTransaction } from "./AsyncTupleDatabase"
import {
	ReactiveAsyncTupleDatabaseApi,
	ReactiveAsyncTupleDatabaseClientArgs,
} from "./types"

export class ReactiveAsyncTupleDatabaseClient
	implements ReactiveAsyncTupleDatabaseApi {
	constructor(public api: ReactiveAsyncTupleDatabaseClientArgs) {}

	async get(tuple: Tuple, txId?: TxId): Promise<any> {
		return this.api.get(tuple, txId)
	}
	async exists(tuple: Tuple, txId?: TxId): Promise<boolean> {
		return this.api.exists(tuple, txId)
	}
	async scan(args?: ScanArgs, txId?: TxId): Promise<TupleValuePair[]> {
		return this.api.scan(args, txId)
	}
	async commit(writes: Writes, txId?: string): Promise<void> {
		return this.api.commit(writes, txId)
	}
	async cancel(txId: string): Promise<void> {
		return this.api.cancel(txId)
	}

	async subscribe(args: ScanArgs, callback: Callback): Promise<Unsubscribe> {
		return this.api.subscribe(args, callback)
	}

	transact(txId?: TxId) {
		const id = txId || randomId()
		return new AsyncTupleTransaction(this, id)
	}

	close() {
		return this.api.close()
	}
}
