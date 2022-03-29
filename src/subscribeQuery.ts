import {
	KeyValuePair,
	ReadOnlyTupleDatabaseClientApi,
	TupleDatabaseClient,
	TupleDatabaseClientApi,
} from "./main"

const throwError = () => {
	throw new Error()
}

export function subscribeQuery<S extends KeyValuePair, T>(
	db: TupleDatabaseClientApi<S>,
	fn: (db: ReadOnlyTupleDatabaseClientApi<S>) => T,
	callback: (result: T) => void
): { result: T; destroy: () => void } {
	const listeners = new Set<any>()

	const compute = () => fn(listenDb)

	const resetListeners = () => {
		listeners.forEach((destroy) => destroy())
		listeners.clear()
	}

	const recompute = () => {
		resetListeners()
		callback(compute())
	}

	// Subscribe for every scan that gets called.
	const listenDb = new TupleDatabaseClient<S>({
		scan: (args: any, txId) => {
			if (txId) throwError()

			const results = db.scan(args)

			// Subscribe
			// TODO: recompute only once per transaction commit...
			// Need some kind of db.afterWrite()
			// Also make sure we dont write again immediately in a subscribe...
			const destroy = db.subscribe(args, recompute)
			listeners.add(destroy)

			return results
		},
		// This is ReadOnly...
		commit: throwError,
		cancel: throwError,
		subscribe: throwError,
		close: throwError,
	})

	const result = compute()
	const destroy = resetListeners
	return { result, destroy }
}

export function useTupleDatabaseClient<S extends KeyValuePair, T>(
	db: TupleDatabaseClientApi<S>,
	fn: (db: ReadOnlyTupleDatabaseClientApi<S>) => T
) {
	// fn({
	// 	scan: <P extends TuplePrefix<S["key"]>>(
	// 		args?: ScanArgs<P>,
	// 		txId?: TxId
	// 	) => Identity<FilterTupleValuePairByPrefix<S, P>[]>
	// 	get: <T extends S["key"]>(
	// 		tuple: T,
	// 		txId?: TxId
	// 	) => Identity<ValueForTuple<S, T> | undefined>
	// 	exists: <T extends S["key"]>(tuple: T, txId?: TxId) => Identity<boolean>
	// 	subspace: <P extends TuplePrefix<S["key"]>>(
	// 		prefix: P
	// 	) => ReadOnlyTupleDatabaseClientApi<RemoveTupleValuePairPrefix<S, P>>
	// })
}

// export function useAppState<T>(se	lector: (state: Game) => T) {
// 	const { app } = useEnvironment()
// 	const initialState = useMemo(() => {
// 		return selector(app.state)
// 	}, [])

// 	const [state, setState] = useState(initialState)
// 	const currentStateRef = useRefCurrent(state)

// 	useEffect(() => {
// 		return app.addListener(() => {
// 			const nextState = selector(app.state)
// 			if (shallowEqual(currentStateRef.current, nextState)) return
// 			setState(nextState)
// 		})
// 	}, [])

// 	return state
// }
