import { isEqual, omitBy } from "lodash"
import { ScanArgs } from "../database/types"
import { KeyValuePair, ScanStorageArgs, Tuple, Writes } from "../storage/types"
import { normalizeTupleBounds } from "./sortedTupleArray"

export function prependPrefixToTuple(prefix: Tuple, tuple: Tuple): Tuple {
	return [...prefix, ...tuple]
}

function prependPrefixToTuples(prefix: Tuple, tuples: Tuple[]): Tuple[] {
	return tuples.map((tuple) => prependPrefixToTuple(prefix, tuple))
}

function prependPrefixToTupleValuePair(
	prefix: Tuple,
	pair: KeyValuePair
): KeyValuePair {
	const { key, value } = pair
	return {
		key: prependPrefixToTuple(prefix, key),
		value,
	}
}

function prependPrefixToTupleValuePairs(
	prefix: Tuple,
	pairs: KeyValuePair[]
): KeyValuePair[] {
	return pairs.map((pair) => prependPrefixToTupleValuePair(prefix, pair))
}

export function prependPrefixToWrites(prefix: Tuple, writes: Writes): Writes {
	const set = writes.set
		? prependPrefixToTupleValuePairs(prefix, writes.set)
		: undefined

	const remove = writes.remove
		? prependPrefixToTuples(prefix, writes.remove)
		: undefined

	return { set, remove }
}

export function removePrefixFromWrites(prefix: Tuple, writes: Writes): Writes {
	const set = writes.set
		? removePrefixFromTupleValuePairs(prefix, writes.set)
		: undefined

	const remove = writes.remove
		? removePrefixFromTuples(prefix, writes.remove)
		: undefined

	return { set, remove }
}

export function removePrefixFromTuple(prefix: Tuple, tuple: Tuple) {
	if (!isEqual(tuple.slice(0, prefix.length), prefix)) {
		throw new Error("Invalid prefix: " + JSON.stringify({ prefix, tuple }))
	}
	return tuple.slice(prefix.length)
}

function removePrefixFromTuples(prefix: Tuple, tuples: Tuple[]) {
	return tuples.map((tuple) => removePrefixFromTuple(prefix, tuple))
}

function removePrefixFromTupleValuePair(
	prefix: Tuple,
	pair: KeyValuePair
): KeyValuePair {
	const { key, value } = pair
	return { key: removePrefixFromTuple(prefix, key), value }
}

export function removePrefixFromTupleValuePairs(
	prefix: Tuple,
	pairs: KeyValuePair[]
): KeyValuePair[] {
	return pairs.map((pair) => removePrefixFromTupleValuePair(prefix, pair))
}

export function normalizeSubspaceScanArgs(
	subspacePrefix: Tuple,
	args: ScanArgs<Tuple, any>
): ScanStorageArgs {
	const prefix = args.prefix
		? [...subspacePrefix, ...args.prefix]
		: subspacePrefix

	const bounds = normalizeTupleBounds({ ...args, prefix })
	const { limit, reverse } = args

	return omitBy({ ...bounds, limit, reverse }, (x) => x === undefined)
}
