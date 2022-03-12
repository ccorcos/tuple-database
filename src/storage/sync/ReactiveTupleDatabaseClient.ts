/*

This file is generated from async/ReactiveAsyncTupleDatabaseClient.ts

*/
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
import { TupleTransaction } from "./TupleDatabase"
import {
	ReactiveTupleDatabaseApi,
	ReactiveTupleDatabaseClientArgs,
	TupleTransactionApi,
} from "./types"

export class ReactiveTupleDatabaseClient implements ReactiveTupleDatabaseApi {
	constructor(public api: ReactiveTupleDatabaseClientArgs) {}

	get(tuple: Tuple, txId?: TxId): any {
		return this.api.get(tuple, txId)
	}
	exists(tuple: Tuple, txId?: TxId): boolean {
		return this.api.exists(tuple, txId)
	}
	scan(args?: ScanArgs, txId?: TxId): TupleValuePair[] {
		return this.api.scan(args, txId)
	}
	commit(writes: Writes, txId?: string): void {
		return this.api.commit(writes, txId)
	}
	cancel(txId: string): void {
		return this.api.cancel(txId)
	}

	subscribe(args: ScanArgs, callback: Callback): Unsubscribe {
		return this.api.subscribe(args, callback)
	}

	transact(txId?: TxId): TupleTransactionApi {
		const id = txId || randomId()
		return new TupleTransaction(this, id)
	}

	close() {
		return this.api.close()
	}
}
