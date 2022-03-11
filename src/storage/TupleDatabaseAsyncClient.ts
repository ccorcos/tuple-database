import { AsyncTupleDatabaseApi } from "./types"

class TupleDatabaseAsyncClient {
	constructor(public api: AsyncTupleDatabaseApi) {}
}

// export class AsyncTupleDatabase {
// 	constructor(private storage: TupleStorage | AsyncTupleStorage) {}

// 	log = new ConcurrencyLog()

// 	transact(txId?: TxId) {
// 		const id = txId || randomId()
// 		return new AsyncTupleTransaction(this, id)
// 	}

// 	async commit(writes: Writes, txId?: string) {
// 		if (txId) this.log.commit(txId)
// 		for (const tuple of iterateWrittenTuples(writes)) {
// 			this.log.write(txId, tuple)
// 		}
// 		await this.storage.commit(writes)
// 	}

// 	cancel(txId: string) {
// 		this.log.cancel(txId)
// 	}

// 	async close() {
// 		await this.storage.close()
// 	}
// }

// export class AsyncTupleTransaction {
// 	constructor(private storage: AsyncTupleDatabase, public id: TxId) {}

// 	writes: Required<Writes> = { set: [], remove: [] }

// 	async get(tuple: Tuple) {
// 		// TODO: binary searching twice unnecessarily...
// 		if (tv.exists(this.writes.set, tuple)) {
// 			return tv.get(this.writes.set, tuple)
// 		}
// 		if (t.exists(this.writes.remove, tuple)) {
// 			return
// 		}
// 		return this.storage.get(tuple, this.id)
// 	}

// 	async exists(tuple: Tuple) {
// 		if (tv.exists(this.writes.set, tuple)) {
// 			return true
// 		}
// 		if (t.exists(this.writes.remove, tuple)) {
// 			return false
// 		}
// 		return this.storage.exists(tuple, this.id)
// 	}

// 	set(tuple: Tuple, value: any) {
// 		t.remove(this.writes.remove, tuple)
// 		tv.set(this.writes.set, tuple, value)
// 		return this
// 	}

// 	remove(tuple: Tuple) {
// 		tv.remove(this.writes.set, tuple)
// 		t.set(this.writes.remove, tuple)
// 		return this
// 	}

// 	write(writes: Writes) {
// 		// If you're calling this function, then the order of these opertions
// 		// shouldn't matter.
// 		const { set, remove } = writes
// 		for (const tuple of remove || []) {
// 			this.remove(tuple)
// 		}
// 		for (const [tuple, value] of set || []) {
// 			this.set(tuple, value)
// 		}
// 		return this
// 	}

// 	async scan(args: ScanArgs = {}) {
// 		const result = await this.storage.scan(args, this.id)
// 		const sets = tv.scan(this.writes.set, args)
// 		for (const [tuple, value] of sets) {
// 			tv.set(result, tuple, value)
// 		}
// 		const removes = t.scan(this.writes.remove, args)
// 		for (const tuple of removes) {
// 			tv.remove(result, tuple)
// 		}
// 		return result
// 	}

// 	async commit() {
// 		return this.storage.commit(this.writes, this.id)
// 	}

// 	cancel() {
// 		return this.storage.cancel(this.id)
// 	}
// }
