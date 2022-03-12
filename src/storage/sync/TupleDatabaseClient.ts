/*

This file is generated from TupleDatabaseAsyncClient.ts

*/
import { randomId } from "../../helpers/randomId"
import {
	ScanArgs,
	Tuple,
	TupleClientArgs,
	TupleDatabaseApi,
	TupleValuePair,
	TxId,
	Writes,
} from "../types"
import { TupleTransaction } from "./TupleDatabase"

export class TupleDatabaseClient implements TupleDatabaseApi {
	constructor(public api: TupleClientArgs) {}

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

	transact(txId?: TxId) {
		const id = txId || randomId()
		return new TupleTransaction(this, id)
	}

	close() {
		return this.api.close()
	}
}
