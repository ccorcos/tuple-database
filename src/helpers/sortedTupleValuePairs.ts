import { ScanArgs } from "../database/types"
import { KeyValuePair, Tuple } from "../storage/types"
import { compareTuple } from "./compareTuple"
import * as sortedList from "./sortedList"
import { normalizeTupleBounds } from "./sortedTupleArray"

function compareTupleValuePair(a: KeyValuePair, b: KeyValuePair) {
	return compareTuple(a.key, b.key)
}

export function set(data: KeyValuePair[], key: Tuple, value: any) {
	return sortedList.set(data, { key, value }, compareTupleValuePair)
}

export function remove(data: KeyValuePair[], key: Tuple) {
	return sortedList.remove(data, { key, value: null }, compareTupleValuePair)
}

export function get(data: KeyValuePair[], key: Tuple) {
	const pair = sortedList.get(data, { key, value: null }, compareTupleValuePair)
	if (pair !== undefined) return pair.value
}

export function exists(data: KeyValuePair[], key: Tuple) {
	return sortedList.exists(data, { key, value: null }, compareTupleValuePair)
}

function normalizeTupleValuePairBounds(args: ScanArgs) {
	const bounds = normalizeTupleBounds(args)
	const { gt, lt, gte, lte } = bounds
	return {
		gt: gt ? ({ key: gt, value: null } as KeyValuePair) : undefined,
		gte: gte ? ({ key: gte, value: null } as KeyValuePair) : undefined,
		lt: lt ? ({ key: lt, value: null } as KeyValuePair) : undefined,
		lte: lte ? ({ key: lte, value: null } as KeyValuePair) : undefined,
	}
}

export function scan(data: KeyValuePair[], args: ScanArgs = {}) {
	const { limit, reverse, ...rest } = args
	const bounds = normalizeTupleValuePairBounds(rest)
	return sortedList.scan(
		data,
		{ limit, reverse, ...bounds },
		compareTupleValuePair
	)
}
