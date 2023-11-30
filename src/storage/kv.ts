// encoding

// kv = {
//   get(key): {value, version},
//   write(tx: {
//     check: {key, version}[]
//     set: {key, value}[]
//     delete: key[]
//   }): void
// }

// export class InMemoryTupleStorage implements TupleStorageApi {
// 	data: KeyValuePair[]

// 	constructor(data?: KeyValuePair[]) {
// 		this.data = data || []
// 	}

// 	scan(args?: ScanStorageArgs) {
// 		return tv.scan(this.data, args)
// 	}

// 	commit(writes: WriteOps) {
// 		// Indexers run inside the tx so we don't need to do that here.
// 		// And because of that, the order here should not matter.
// 		const { set, remove } = writes
// 		for (const tuple of remove || []) {
// 			tv.remove(this.data, tuple)
// 		}
// 		for (const { key, value } of set || []) {
// 			tv.set(this.data, key, value)
// 		}
// 	}

// 	close() {}
// }

// kv = {
//   get(key): {value, version},
//   write(tx: {
//     check: {key, version}[]
//     set: {key, value}[]
//     delete: key[]
//   }): void
// }

// btree = {
//   scan(start, end): {list: {key, value, version}[], version},
//   write(tx: {
//     check: {start, end, version}[]
//     set: {key, value}[]
//     delete: key[] | {start, end}[]
//   }): void
// }

// itree = {
//   overlaps(start, end): {list: {start, end, key, value, version}[], version},
//   write(tx: {
//     check: {start, end, version}[]
//     set: {key, value}[]
//     delete: key[] | {start, end}[]
//   }): void
// }

// rtree = {...}
