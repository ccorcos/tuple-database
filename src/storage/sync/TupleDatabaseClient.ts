/*

This file is generated from async/AsyncTupleDatabaseClient.ts

*/
import { randomId } from "../../helpers/randomId"
import { ScanArgs, Tuple, TupleValuePair, TxId, Writes } from "../types"
import { TupleTransaction } from "./TupleDatabase"
import {
	TupleDatabaseApi,
	TupleDatabaseClientArgs,
	TupleTransactionApi,
} from "./types"

export class TupleDatabaseClient implements TupleDatabaseApi {
	constructor(public api: TupleDatabaseClientArgs) {}

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

	transact(txId?: TxId): TupleTransactionApi {
		const id = txId || randomId()
		return new TupleTransaction(this, id)
	}

	close() {
		return this.api.close()
	}
}
