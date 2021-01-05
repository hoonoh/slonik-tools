import * as lodash from 'lodash'
import {globAsync} from './util'
import {psqlClient} from './pg'
import * as defaults from './defaults'
import {GdescriberParams, QueryField, DescribedQuery, ExtractedQuery, QueryParameter} from './types'
import {columnInfoGetter} from './query'
import * as assert from 'assert'
import * as path from 'path'
import {parameterTypesGetter} from './query/parameters'

export * from './types'
export * from './defaults'

export const gdescriber = (params: Partial<GdescriberParams> = {}) => {
  const {
    psqlCommand,
    gdescToTypeScript,
    rootDir,
    glob,
    defaultType,
    extractQueries,
    writeTypes,
    pool,
    typeParsers,
  } = defaults.getParams(params)
  const {psql, getEnumTypes, getRegtypeToPGType} = psqlClient(psqlCommand)

  const getFields = async (query: ExtractedQuery): Promise<QueryField[]> => {
    const rows = await psql(`${query.sql} \\gdesc`)
    const fields = await Promise.all(
      rows.map<Promise<QueryField>>(async row => ({
        name: row.Column,
        gdesc: row.Type,
        typescript: await getTypeScriptType(row.Type, row.Column),
      })),
    )

    return Promise.all(fields)
  }

  const getParameterTypes = parameterTypesGetter(pool)
  const getParameters = async (query: ExtractedQuery): Promise<QueryParameter[]> => {
    const regtypes = await getParameterTypes(query.sql)
    const enumTypes = await getEnumTypes()

    return regtypes.map((regtype, i) => ({
      name: `param_${i + 1}`, // todo: parse query and use heuristic to get sensible names
      regtype,
      typescript:
        // todo: handle arrays and other more complex types. Right now they'll fall back to `defaultType` (= `any` or `unknown`)
        defaults.defaultPGDataTypeToTypeScriptMappings[regtype] ||
        enumTypes[regtype]?.map(t => JSON.stringify(t.enumlabel)).join(' | ') ||
        defaultType,
    }))
  }

  const getTypeScriptType = async (regtype: string, typeName: string): Promise<string> => {
    assert.ok(regtype, `No regtype found!`)

    const enumTypes = await getEnumTypes()
    const regtypeToPGType = await getRegtypeToPGType()

    if (regtype.endsWith('[]')) {
      return `Array<${await getTypeScriptType(regtype.slice(0, -2), typeName)}>`
    }

    if (regtype.match(/\(\d+\)/)) {
      // e.g. `character varying(10)`, which is the regtype from `create table t(s varchar(10))`
      return getTypeScriptType(regtype.split('(')[0], typeName)
    }

    const pgtype = regtypeToPGType[regtype].typname

    assert.ok(pgtype, `pgtype not found from regtype ${regtype}`)

    return (
      lodash.findLast(typeParsers, p => p.pgtype === pgtype)?.typescript ||
      gdescToTypeScript(regtype, typeName) ||
      defaults.defaultPGDataTypeToTypeScriptMappings[regtype] ||
      enumTypes[regtype]?.map(t => JSON.stringify(t.enumlabel)).join(' | ') ||
      defaultType
    )
  }

  const findAll = async () => {
    const getColumnInfo = columnInfoGetter(pool)

    const globParams: Parameters<typeof globAsync> = typeof glob === 'string' ? [glob, {}] : glob
    const files = await globAsync(globParams[0], {
      ...globParams[1],
      cwd: path.resolve(process.cwd(), rootDir),
      absolute: true,
    })

    const promises = files.flatMap(extractQueries).map(
      async (query): Promise<DescribedQuery | null> => {
        try {
          return {
            ...query,
            fields: await getFields(query),
            parameters: await getParameters(query),
          }
        } catch (e) {
          console.error(`Describing query failed: ${e}`)
          return null
        }
      },
    )

    const describedQueries = lodash.compact(await Promise.all(promises))

    const analysedQueries = await Promise.all(describedQueries.map(getColumnInfo))

    // const queries = await Promise.all(lodash.compact(await Promise.all(promises)).map(getColumnInfo))

    writeTypes(analysedQueries)
  }

  return findAll()
}
