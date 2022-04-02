import { maybeWaitForPromises } from "../../helpers/maybeWaitForPromises"
import { randomId } from "../../helpers/randomId"
import {
	Bounds,
	getPrefixContainingBounds,
	isTupleWithinBounds,
} from "../../helpers/sortedTupleArray"
import { InMemoryTupleStorage } from "../../storage/InMemoryTupleStorage"
import { MIN, ScanStorageArgs, Tuple, Writes } from "../../storage/types"
import { TupleStorageApi } from "../sync/types"
import { AsyncCallback } from "./asyncTypes"

export class AsyncReactivityTracker {
	private listenersDb = new InMemoryTupleStorage()

	subscribe(args: ScanStorageArgs, callback: AsyncCallback) {
		return subscribe(this.listenersDb, args, callback)
	}

	computeReactivityEmits(writes: Writes) {
		return getReactivityEmits(this.listenersDb, writes)
	}

	async emit(emits: ReactivityEmits) {
		let promises: any[] = []
		for (const [callback, writes] of emits.entries()) {
			try {
				// Catch sync callbacks.
				promises.push(callback(writes))
			} catch (error) {
				console.error(error)
			}
		}
		// This trick allows us to return a Promise from a sync TupleDatabase#commit
		// when there are async callbacks. And this allows us to create an async client
		// on top of a sync client.
		return maybeWaitForPromises(promises)
	}
}

type AsyncListener = { callback: AsyncCallback; bounds: Bounds }

function iterateTuplePrefixes(tuple: Tuple) {
	const prefixes: Tuple[] = [tuple]
	for (let i = 0; i < tuple.length; i++) {
		const prefix = tuple.slice(0, i)
		prefixes.push(prefix)
	}
	return prefixes
}

/** Query the listenersDb based on tuple prefixes. */
function getListenersForTuplePrefix(
	listenersDb: TupleStorageApi,
	tuple: Tuple
) {
	const listeners: AsyncListener[] = []

	// Look for listeners at each prefix of the tuple.
	for (const prefix of iterateTuplePrefixes(tuple)) {
		const results = listenersDb.scan({
			gte: [prefix],
			lt: [[...prefix, MIN]],
		})

		for (const { value } of results) {
			listeners.push(value)
		}
	}

	return listeners
}

/** Query the listenersDb based on tuple prefixes, and additionally check for query bounds. */
function getListenerCallbacksForTuple(
	listenersDb: TupleStorageApi,
	tuple: Tuple
) {
	const callbacks: AsyncCallback[] = []

	// Check that the tuple is within the absolute bounds of the query.
	for (const listener of getListenersForTuplePrefix(listenersDb, tuple)) {
		const { callback, bounds } = listener
		if (isTupleWithinBounds(tuple, bounds)) {
			callbacks.push(callback)
		} else {
			// TODO: track how in-efficient listeners are here.
			// NOTE: the bounds may only partially span the prefix.
		}
	}

	return callbacks
}

type ReactivityEmits = Map<AsyncCallback, Required<Writes>>

function getReactivityEmits(listenersDb: TupleStorageApi, writes: Writes) {
	const emits: ReactivityEmits = new Map()

	for (const { key, value } of writes.set || []) {
		const callbacks = getListenerCallbacksForTuple(listenersDb, key)
		for (const callback of callbacks) {
			if (!emits.has(callback)) emits.set(callback, { set: [], remove: [] })
			emits.get(callback)!.set.push({ key, value })
		}
	}

	for (const tuple of writes.remove || []) {
		const callbacks = getListenerCallbacksForTuple(listenersDb, tuple)
		for (const callback of callbacks) {
			if (!emits.has(callback)) emits.set(callback, { set: [], remove: [] })
			emits.get(callback)!.remove.push(tuple)
		}
	}

	return emits
}

function subscribe(
	listenersDb: TupleStorageApi,
	args: ScanStorageArgs,
	callback: AsyncCallback
) {
	// this.log("db/subscribe", args)

	const prefix = getPrefixContainingBounds(args)

	const id = randomId()
	const value: AsyncListener = { callback, bounds: args }

	listenersDb.commit({ set: [{ key: [prefix, id], value }] })

	const unsubscribe = () => {
		// this.log("db/unsubscribe", args)
		listenersDb.commit({ remove: [[prefix, id]] })
	}

	return unsubscribe
}
