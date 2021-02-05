import { isEqual } from "lodash"
import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { remove, set } from "../helpers/sortedTupleArray"
import { ReactiveStorage } from "../storage/ReactiveStorage"
import { ScanArgs, Tuple } from "../storage/types"

export function useSubscribe(
	db: ReactiveStorage,
	index: string,
	args: ScanArgs
) {
	const argsDep = useDeepEqual(args)
	const rerender = useRerender()
	const data = useRef<Array<Tuple>>([])

	// Even though this is an "effect", we call useMemo so it runs synchronously so
	// that we don't lose a tick and have to call setState immediately after rendering.
	const unsubscribe = useMemo(() => {
		const [result, unsubscribe] = db.subscribe(index, args, (updates) => {
			const oldState = data.current
			// Apply the updates to the state.
			const newState = [...oldState]
			for (const tuple of updates[index].removes) {
				remove(newState, tuple)
			}
			for (const tuple of updates[index].sets) {
				set(newState, tuple)
			}
			data.current = newState
			rerender()
		})
		data.current = result
		return unsubscribe
	}, [db, index, argsDep])

	useEffect(() => unsubscribe, [unsubscribe])

	return data.current
}

function useRerender() {
	const [state, setState] = useState(0)
	const rerender = useCallback(() => setState((state) => state + 1), [])
	return rerender
}

/**
 * The return value changes only when the object's deep comparison changes.
 * This is useful for object you want to use as React hooks dependencies.
 */
function useDeepEqual(obj: any) {
	const prev = usePrevious(obj)

	const counter = useRef(1)

	if (!isEqual(prev, obj)) {
		counter.current += 1
	}

	return counter.current
}

function usePrevious<T>(value: T) {
	const prev = useRef<T | undefined>()
	useEffect(() => {
		prev.current = value
	}, [value])
	return prev.current
}
