import {
	ArrayEncoding,
	BooleanEncoding,
	Codec,
	NullEncoding,
	NumberEncoding,
	ObjectLegacyEncoding,
	StringEncoding,
} from "lexicodec"

export const codec = new Codec({
	b: NullEncoding,
	c: ObjectLegacyEncoding,
	d: ArrayEncoding,
	e: NumberEncoding,
	f: StringEncoding,
	g: BooleanEncoding,
})
