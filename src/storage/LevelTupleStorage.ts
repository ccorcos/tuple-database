import { AbstractBatch } from "abstract-leveldown"
import level from "level"
import {
	decodeTuple,
	decodeValue,
	encodeTuple,
	encodeValue,
} from "../helpers/codec"
import {
	AsyncTupleStorageApi,
	ScanStorageArgs,
	TupleValuePair,
	Writes,
} from "./types"

export class LevelTupleStorage implements AsyncTupleStorageApi {
	/**
	 * import level from "level"
	 * new LevelTupleStorage(level("path/to.db"))
	 */
	constructor(public db: level.LevelDB) {}

	async scan(args: ScanStorageArgs): Promise<TupleValuePair[]> {
		return new Promise((resolve, reject) => {
			const dbArgs: any = {}
			if (args.gt !== undefined) dbArgs.gt = encodeTuple(args.gt)
			if (args.gte !== undefined) dbArgs.gte = encodeTuple(args.gte)
			if (args.lt !== undefined) dbArgs.lt = encodeTuple(args.lt)
			if (args.lte !== undefined) dbArgs.lte = encodeTuple(args.lte)
			if (args.limit !== undefined) dbArgs.limit = args.limit
			if (args.reverse !== undefined) dbArgs.reverse = args.reverse

			const stream = this.db.createReadStream(dbArgs)

			const results: TupleValuePair[] = []
			stream
				.on("data", function (data) {
					results.push([decodeTuple(data.key), decodeValue(data.value)])
				})
				.on("error", reject)
				.on("close", function () {
					resolve(results)
				})
		})
	}

	async commit(writes: Writes): Promise<void> {
		const ops = [
			...(writes.remove || []).map(
				(tuple) =>
					({
						type: "del",
						key: encodeTuple(tuple),
					} as AbstractBatch)
			),
			...(writes.set || []).map(
				([tuple, value]) =>
					({
						type: "put",
						key: encodeTuple(tuple),
						value: encodeValue(value),
					} as AbstractBatch)
			),
		]

		await this.db.batch(ops)
	}

	async close(): Promise<void> {
		return this.db.close()
	}
}
