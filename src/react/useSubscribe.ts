import { isEqual } from "lodash"
import { useEffect, useState, useRef } from "react"
import { remove, set } from "../helpers/sortedTupleArray"
import { ReactiveStorage } from "../storage/ReactiveStorage"
import { ScanArgs } from "../storage/types"

export function useSubscribe(
	db: ReactiveStorage,
	index: string,
	args: ScanArgs
) {
	const [state, setState] = useState([])
	const argsDep = useDeepEqual(args)

	useEffect(() => {
		const [result, unsubscribe] = db.subscribe(index, args, (updates) => {
			setState((oldState) => {
				// Apply the updates to the state.
				const newState = [...oldState]
				for (const tuple of updates[index].removes) {
					remove(newState, tuple)
				}
				for (const tuple of updates[index].sets) {
					set(newState, tuple)
				}
				return newState
			})
		})

		// Set the initial results.
		setState(result)
		return unsubscribe
	}, [db, index, argsDep])

	return state
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
	const prev = useRef()
	useEffect(() => {
		prev.current = value
	}, [value])
	return prev.current
}
