import { useEffect, useRef } from "react"
import { AsyncTupleDatabaseClientApi } from "./database/async/asyncTypes"
import { shallowEqual } from "./helpers/shallowEqual"
import { useRerender } from "./helpers/useRerender"
import { subscribeQueryAsync } from "./main"
import { KeyValuePair } from "./storage/types"

/** Useful for managing UI state for React with a TupleDatabase. */
export function useAsyncTupleDatabase<
	S extends KeyValuePair,
	T,
	A extends any[]
>(
	db: AsyncTupleDatabaseClientApi<S>,
	fn: (db: AsyncTupleDatabaseClientApi<S>, ...arg: A) => Promise<T>,
	args: A
) {
	const rerender = useRerender()
	const resultRef = useRef<T | undefined>(undefined)

	useEffect(() => {
		let stopped = false
		let stop: (() => void) | undefined
		subscribeQueryAsync(
			db,
			(db) => fn(db, ...args),
			(result) => {
				if (stopped) return
				if (!shallowEqual(resultRef.current, result)) {
					resultRef.current = result
					rerender()
				}
			}
		).then(({ result, destroy }) => {
			resultRef.current = result
			if (stopped) destroy()
			else stop = destroy
		})
		return () => {
			stopped = true
			if (stop) stop()
		}
	}, [db, fn, ...args])

	return resultRef.current
}
