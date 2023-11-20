import { useEffect, useMemo, useRef } from "react"
import { subscribeQuery } from "./database/sync/subscribeQuery"
import { TupleDatabaseClientApi } from "./database/sync/types"
import { shallowEqual } from "./helpers/shallowEqual"
import { useRerender } from "./helpers/useRerender"

/** Useful for managing UI state for React with a TupleDatabase. */
export function useTupleDatabase<T, A extends any[]>(
	db: TupleDatabaseClientApi,
	fn: (db: TupleDatabaseClientApi, ...arg: A) => T,
	args: A
) {
	const rerender = useRerender()
	const resultRef = useRef<T>({} as any)

	const destroy = useMemo(() => {
		const { result, destroy } = subscribeQuery(
			db,
			(db) => fn(db, ...args),
			(result) => {
				if (!shallowEqual(resultRef.current, result)) {
					resultRef.current = result
					rerender()
				}
			}
		)
		resultRef.current = result
		return destroy
	}, [db, fn, ...args])

	useEffect(() => {
		return destroy
	}, [destroy])

	return resultRef.current
}
