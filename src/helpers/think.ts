import _ from "lodash"
import { groupBy } from "lodash"
import { Tuple, Value } from "../storage/types"

type Session = {
	id: string
	objects: Array<string>
}

type SessionTuple = [string, "name", string] | [string, "objects", string]

function group(tuples: [string, ...Tuple][]): { [first: string]: Tuple[] } {
	return _(tuples)
		.groupBy((tuple) => tuple[0])
		.mapValues((tuples) => tuples.map(([first, ...rest]) => rest))
		.value()
}

// function eavToSessions(tuples: Array<Tuple>) {
// 	_(group(tuples))
// }

// TODO:
// - first we need to solve the ID / custom data types middleware problem
// - then we need to create runtime validators for type assertions.
// - last, if we want, we can think about orm ux.
// - {uuid: string} sounds good enough to me. {date: string} can work just as well.
