import {
	Transaction,
	Index,
	ScanArgs,
	Tuple,
	Value,
	ReadOnlyStorage,
	Storage,
} from "./storage"
import * as json from "../helpers/json"
import { Variable } from "./query"
import { getListenKey } from "./factListenerHelpers"
import { getScanBounds } from "./indexHelpers"
import { compareTuple } from "./compareTuple"

function getPrefixListenKey(index: Index, scanArgs: ScanArgs) {
	// Compute the common prefix.
	const prefix: Array<Value | Variable> = []
	const start = scanArgs.start || scanArgs.startAfter || []
	const end = scanArgs.end || scanArgs.endBefore || []
	for (let i = 0; i < index.sort.length; i++) {
		if (i >= start.length || i >= end.length) {
			prefix.push({ var: "" })
		}
		if (start[i] === end[i]) {
			prefix.push(start[i])
		}
	}
	return getListenKey(prefix)
}

function getPrefixListenKeys(tuple: Tuple) {
	// Compute the common prefix.
	const tuples: Array<Array<Value | Variable>> = []
	for (let i = 0; i < tuple.length; i++) {
		for (const t of tuples) {
			t.push({ var: "" })
		}
		tuples.push(tuple.slice(0, i))
	}
	return tuples.map(getListenKey)
}

const listeners: Index = {
	name: "listeners",
	sort: [1, 1, 1],
}
const subscriptions: Index = {
	name: "subscriptions",
	sort: [1, 1],
}

type SubscriptionData = {
	index: Index
	scanArgs: ScanArgs
}

export function createIndexSubscription(
	transaction: Transaction,
	index: Index,
	scanArgs: ScanArgs,
	subscriptionId: string
) {
	// Compute the common prefix.
	const prefix = getPrefixListenKey(index, scanArgs)
	const data: SubscriptionData = { index, scanArgs }
	transaction.set(subscriptions, [subscriptionId, json.stringify(data)])
	transaction.set(listeners, [index.name, prefix, subscriptionId])
}

export function destroyIndexSubscription(
	transaction: Transaction,
	subscriptionId: string
) {
	const tuples = transaction.scan(subscriptions, {
		start: [subscriptionId],
		end: [subscriptionId],
	})
	for (const [subscriptionId, data] of tuples) {
		const { index, scanArgs } = JSON.parse(data as string) as SubscriptionData
		const prefix = getPrefixListenKey(index, scanArgs)
		transaction.remove(listeners, [index.name, prefix, subscriptionId])
		transaction.remove(subscriptions, [subscriptionId, data])
	}
}

export function getIndexSubscriptionUpdates(
	storage: ReadOnlyStorage,
	index: Index,
	tuple: Tuple
) {
	const subscriptionIds: Array<string> = []
	const prefixes = getPrefixListenKeys(tuple)
	for (const prefix of prefixes) {
		const tuples = storage.scan(listeners, {
			start: [index.name, prefix],
			end: [index.name, prefix],
		})
		for (const [_indexName, _prefix, subscriptionId] of tuples) {
			const tuples = storage.scan(subscriptions, {
				start: [subscriptionId],
				end: [subscriptionId],
			})
			for (const [subscriptionId, data] of tuples) {
				const { index, scanArgs } = JSON.parse(
					data as string
				) as SubscriptionData
				const compare = compareTuple(index.sort)
				const { start, end } = getScanBounds(index.sort, scanArgs)
				if (compare(start, tuple) !== 1 && compare(tuple, end) !== 1) {
					subscriptionIds.push(subscriptionId as string)
				}
			}
		}
	}
	return subscriptionIds
}
