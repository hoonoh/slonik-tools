/* eslint-disable */
// tslint:disable
// this file is generated by a tool; don't change it manually.

export type FooSubset_AllTypes = [
  {
    /** pg_type.typname: text */
    a: string
  },
    {
    /** pg_type.typname: text */
    a: string
    /** pg_type.typname: bool */
    b: boolean
  },
    {
    /** pg_type.typname: text */
    a: string
    /** pg_type.typname: bool */
    b: boolean
    /** pg_type.typname: _text */
    c: string[]
  }
]
export interface FooSubset_QueryTypeMap {
  [`select a from foo`]: FooSubset_AllTypes[0]
  [`select a, b from foo`]: FooSubset_AllTypes[1]
  [`select a, b, c from foo`]: FooSubset_AllTypes[2]
  [`select a, b, c from foo where 1 = 1`]: FooSubset_AllTypes[2]
}

export type FooSubset_UnionType = FooSubset_QueryTypeMap[keyof FooSubset_QueryTypeMap]

export type FooSubset = {
  [K in keyof FooSubset_UnionType]: FooSubset_UnionType[K]
}
export const FooSubset = {} as FooSubset

export const FooSubset_meta_v0 = [{"properties":[{"name":"a","value":"string","description":"pg_type.typname: text"}],"description":"select a from foo"},{"properties":[{"name":"a","value":"string","description":"pg_type.typname: text"},{"name":"b","value":"boolean","description":"pg_type.typname: bool"}],"description":"select a, b from foo"},{"properties":[{"name":"a","value":"string","description":"pg_type.typname: text"},{"name":"b","value":"boolean","description":"pg_type.typname: bool"},{"name":"c","value":"string[]","description":"pg_type.typname: _text"}],"description":"select a, b, c from foo"},{"properties":[{"name":"a","value":"string","description":"pg_type.typname: text"},{"name":"b","value":"boolean","description":"pg_type.typname: bool"},{"name":"c","value":"string[]","description":"pg_type.typname: _text"}],"description":"select a, b, c from foo where 1 = 1"}]