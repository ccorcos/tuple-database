import { ScanArgs, Tuple, TupleValuePair } from "../storage/types"
import { compareTuple } from "./compareTuple"
import * as sortedList from "./sortedList"
import { normalizeTupleBounds } from "./sortedTupleArray"

function compareTupleValuePair(a: TupleValuePair, b: TupleValuePair) {
	return compareTuple(a[0], b[0])
}

export function set(data: TupleValuePair[], tuple: Tuple, value: any) {
	return sortedList.set(data, [tuple, value], compareTupleValuePair)
}

export function remove(data: TupleValuePair[], tuple: Tuple) {
	return sortedList.remove(data, [tuple, null], compareTupleValuePair)
}

export function get(data: TupleValuePair[], tuple: Tuple) {
	const pair = sortedList.get(data, [tuple, null], compareTupleValuePair)
	if (pair !== undefined) return pair[1]
}

export function exists(data: TupleValuePair[], tuple: Tuple) {
	return sortedList.exists(data, [tuple, null], compareTupleValuePair)
}

function normalizeTupleValuePairBounds(args: ScanArgs) {
	const bounds = normalizeTupleBounds(args)
	const { gt, lt, gte, lte } = bounds
	return {
		gt: gt ? ([gt, null] as TupleValuePair) : undefined,
		gte: gte ? ([gte, null] as TupleValuePair) : undefined,
		lt: lt ? ([lt, null] as TupleValuePair) : undefined,
		lte: lte ? ([lte, null] as TupleValuePair) : undefined,
	}
}

export function scan(data: TupleValuePair[], args: ScanArgs = {}) {
	const { limit, reverse, ...rest } = args
	const bounds = normalizeTupleValuePairBounds(rest)
	return sortedList.scan(
		data,
		{ limit, reverse, ...bounds },
		compareTupleValuePair
	)
}
