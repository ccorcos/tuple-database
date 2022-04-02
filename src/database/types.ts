import { KeyValuePair, Tuple, Writes } from "../storage/types"

export type ScanArgs<T extends Tuple = Tuple> = {
	gt?: T
	gte?: T
	lt?: T
	lte?: T
	prefix?: T
	limit?: number
	reverse?: boolean
}

export type TxId = string

export type Callback<S extends KeyValuePair = KeyValuePair> = (
	write: Writes<S>,
	txId: string
) => void
export type Unsubscribe = () => void
