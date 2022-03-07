import * as t from "./helpers/sortedTupleArray"
import * as tv from "./helpers/sortedTupleValuePairs"
import { Tuple, Writes } from "./storage/types"

class AsyncStorage {
	async get(id: Tuple) {
		return "data:" + id
	}
}

class SyncStorage {
	get(id: Tuple) {
		return "data:" + id
	}
}

function* f() {
	yield 1
}

type Unpromised<X> = X extends Promise<infer T> ? T : X
type Yielded<F extends (...args: any[]) => any> = Unpromised<ReturnType<F>>

class InMemoryTransaction {
	constructor(private storage: AsyncStorage | SyncStorage) {}

	*get(
		tuple: Tuple
	): Generator<unknown | Promise<unknown>, string | undefined, unknown> {
		// TODO: binary searching twice unnecessarily...
		if (tv.exists(this.writes.set, tuple)) {
			return tv.get(this.writes.set, tuple)
		}
		if (t.exists(this.writes.remove, tuple)) {
			// return undefined
		}
		const obj = (yield this.storage.get(tuple)) as Yielded<
			typeof this.storage.get
		>
		return obj
	}

	private writes: Required<Writes> = { set: [], remove: [] }
}
