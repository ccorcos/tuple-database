import { intersection, isArray, isPlainObject } from "lodash"
import { useEffect, useMemo, useRef, useState } from "react"
import { subscribeQuery } from "./database/sync/subscribeQuery"
import { TupleDatabaseClientApi } from "./database/sync/types"
import { KeyValuePair } from "./storage/types"

function shallowEqual(a: any, b: any) {
	if (a == b) return true
	if (isArray(a)) {
		if (!isArray(b)) return false
		if (a.length !== b.length) return false
		return a.every((x, i) => b[i] === x)
	}
	if (isPlainObject(a)) {
		if (!isPlainObject(b)) return false
		const keys = Object.keys(a)
		const sameKeys = intersection(keys, Object.keys(b))
		if (keys.length !== sameKeys.length) return false
		return keys.every((key) => a[key] == b[key])
	}
	return false
}

function useRerender() {
	const [state, setState] = useState(0)

	const mounted = useRef(true)
	useEffect(
		() => () => {
			mounted.current = false
		},
		[]
	)

	return () => {
		if (!mounted.current) return
		setState((x) => x + 1)
	}
}

/** Useful for managing UI state for React with a TupleDatabase. */
export function useTupleDatabase<S extends KeyValuePair, T, A extends any[]>(
	db: TupleDatabaseClientApi<S>,
	fn: (db: TupleDatabaseClientApi<S>, ...arg: A) => T,
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
