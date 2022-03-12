import { randomId } from "../../helpers/randomId"
import { ScanArgs, Tuple, TupleValuePair, TxId, Writes } from "../types"
import { AsyncTupleTransaction } from "./AsyncTupleDatabase"
import {
	AsyncTupleDatabaseApi,
	AsyncTupleDatabaseClientArgs,
	AsyncTupleTransactionApi,
} from "./types"

export class AsyncTupleDatabaseClient implements AsyncTupleDatabaseApi {
	constructor(public api: AsyncTupleDatabaseClientArgs) {}

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

	transact(txId?: TxId): AsyncTupleTransactionApi {
		const id = txId || randomId()
		return new AsyncTupleTransaction(this, id)
	}

	close() {
		return this.api.close()
	}
}
