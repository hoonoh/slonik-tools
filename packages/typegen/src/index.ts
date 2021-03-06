import {
  QueryResultRowType,
  sql as slonikSql,
  TaggedTemplateLiteralInvocationType,
  ValueExpressionType,
  ClientConfigurationType,
} from 'slonik'

import * as fs from 'fs'
import {basename, join} from 'path'
import {inspect} from 'util'
import {EOL} from 'os'

const keys = <T>(obj: T) => Object.keys(obj) as Array<keyof T>
const fromPairs = <K, V>(pairs: Array<[K, V]>) =>
  pairs.reduce((obj, [k, v]) => ({...obj, [k as any]: v}), {} as Record<string, V>) as Record<string, V>
const orderBy = <T>(list: readonly T[], cb: (value: T) => string | number) =>
  [...list].sort((a, b) => {
    const left = cb(a)
    const right = cb(b)
    return left < right ? -1 : left > right ? 1 : 0
  })
const groupBy = <T>(list: readonly T[], getKey: (value: T) => string | number) => {
  const record: Record<string, T[] | undefined> = {}
  list.forEach(value => {
    const key = getKey(value)
    record[key] = record[key] || []
    record[key]!.push(value)
  })
  return record
}

export interface GenericSqlTaggedTemplateType<T> {
  <U = T>(template: TemplateStringsArray, ...vals: ValueExpressionType[]): TaggedTemplateLiteralInvocationType<U>
}

export interface TypeGenConfig<KnownTypes> {
  knownTypes: KnownTypes
  /**
   * where to write types.
   * if this is a string, types will be written to the path with that value
   */
  writeTypes?: false | string
  /**
   * if true, generated code directory will be wiped and reinitialised on startup.
   */
  reset?: boolean
  /**
   * map from postgres data type id (oid) to io-ts-codegen type.
   */
  typeMapper?: {
    [K in keyof PgTypes<KnownTypes>]?: [string, (value: string) => unknown]
  }
}

export type PgTypes<KnownTypes> = {
  [K in '_pg_types']: K extends keyof KnownTypes ? KnownTypes[K] : never
}['_pg_types']

export type DefaultType<KnownTypes> = {
  [K in 'defaultType']: K extends keyof KnownTypes ? KnownTypes[K] : QueryResultRowType
}['defaultType']

export type TypeGenClientConfig = Pick<ClientConfigurationType, 'interceptors' | 'typeParsers'>
export interface TypeGen<KnownTypes> {
  poolConfig: TypeGenClientConfig
  sql: typeof slonikSql &
    {
      [K in keyof KnownTypes]: GenericSqlTaggedTemplateType<KnownTypes[K]>
    } &
    {
      [K in string]: GenericSqlTaggedTemplateType<DefaultType<KnownTypes>>
    }
}

export const setupTypeGen = <KnownTypes>(config: TypeGenConfig<KnownTypes>): TypeGen<KnownTypes> => {
  const {sql: sqlGetter, poolConfig} = setupSqlGetter(config)
  const _sql: any = (...args: Parameters<typeof slonikSql>) => slonikSql(...args)
  Object.keys(config.knownTypes).forEach(name => (_sql[name] = sqlGetter(name)))
  return {
    poolConfig,
    sql: new Proxy(_sql, {
      get(_, key) {
        if (key in slonikSql) {
          return (slonikSql as any)[key]
        }
        if (typeof key === 'string' && !(key in _sql)) {
          return (_sql[key] = sqlGetter(key))
        }
        return _sql[key]
      },
    }),
  }
}

export interface TypeGenWithSqlGetter<KnownTypes> {
  poolConfig: TypeGenClientConfig
  sql: <Identifier extends string>(
    identifier: Identifier,
  ) => GenericSqlTaggedTemplateType<Identifier extends keyof KnownTypes ? KnownTypes[Identifier] : any>
}

export const createCodegenDirectory = (directory: string) => {
  fs.mkdirSync(directory, {recursive: true})
  fs.writeFileSync(join(directory, 'index.ts'), 'export const knownTypes = {}' + EOL, 'utf8')
}

const writeIfChanged = (path: string, content: string) => {
  const trimmed = content.trim()
  const existingContent = fs.existsSync(path) ? fs.readFileSync(path).toString().trim() : null
  if (trimmed === existingContent) {
    return
  }
  fs.writeFileSync(path, trimmed + EOL, 'utf8')
}

export const resetCodegenDirectory = (directory: string) => {
  if (fs.existsSync(directory)) {
    fs.readdirSync(directory).forEach(filename => fs.unlinkSync(join(directory, filename)))
    fs.rmdirSync(directory)
  }
  createCodegenDirectory(directory)
}

export const setupSqlGetter = <KnownTypes>(config: TypeGenConfig<KnownTypes>): TypeGenWithSqlGetter<KnownTypes> => {
  if (config.reset && typeof config.writeTypes === 'string') {
    resetCodegenDirectory(config.writeTypes)
  }
  const typeParsers = config.typeMapper
    ? keys(config.typeMapper).map(name => ({
        name: name as string,
        parse: config.typeMapper![name]![1],
      }))
    : []
  if (!config.writeTypes) {
    // not writing types, no need to track queries or intercept results
    return {
      sql: Object.assign(() => slonikSql, fromPairs(keys(config.knownTypes).map(k => [k, slonikSql]))),
      poolConfig: {
        interceptors: [],
        typeParsers,
      },
    }
  }
  const writeTypes = getFsTypeWriter(config.writeTypes)

  let _oidToTypeName: Record<number, string | undefined> | undefined
  let _pg_types: Record<string, string | undefined> | undefined
  let _pg_enums: Record<string, string[] | undefined> | undefined
  const mapping: Record<string, [string] | undefined> = config.typeMapper || ({} as any)
  const typescriptTypeName = (dataTypeId: number): string => {
    const typeName = _oidToTypeName && _oidToTypeName[dataTypeId]
    if (typeName && _pg_enums && _pg_enums[typeName]?.length! > 0) {
      return _pg_enums[typeName]!.map(value => `'${value}'`).join(' | ')
    }
    const typescriptTypeName =
      typeName &&
      (() => {
        const [customType] = mapping[typeName] || [undefined]
        return customType || builtInTypeMappings[typeName]
      })()
    return typescriptTypeName || 'unknown'
  }

  const _map: Record<string, string[] | undefined> = {}
  const mapKey = (sqlValue: {sql: string; values?: any}) => JSON.stringify([sqlValue.sql, sqlValue.values])

  const sql: TypeGenWithSqlGetter<KnownTypes>['sql'] = identifier => {
    const _wrappedSqlFunction = (...args: Parameters<typeof slonikSql>) => {
      const result = slonikSql(...args)
      const key = mapKey(result)
      const _identifiers = (_map[key] = _map[key] || [])
      _identifiers.push(identifier)
      return result
    }
    return Object.assign(_wrappedSqlFunction, slonikSql)
  }
  return {
    sql,
    poolConfig: {
      interceptors: [
        {
          afterPoolConnection: async (_context, connection) => {
            if (!_oidToTypeName && typeof config.writeTypes === 'string') {
              type PgType = {typname: string; oid: number}
              const types = orderBy(
                await connection.any(slonikSql<PgType>`
                  select typname, oid
                  from pg_type
                  where (typnamespace = 11 and typname not like 'pg_%')
                  or (typrelid = 0 and typelem = 0)
                `),
                t => `${t.typname}`.replace(/^_/, 'zzz'),
              )

              type PgEnum = {enumtypid: number; enumlabel: string}
              const _oidToEnumValues = groupBy(
                await connection.any(slonikSql<PgEnum>`
                  select enumtypid, enumlabel from pg_enum
                `),
                row => row.enumtypid,
              )

              _pg_types = fromPairs(types.map(t => [t.typname, t.typname as string]))

              _pg_enums = fromPairs(
                types // breakme
                  .filter(t => t.oid in _oidToEnumValues)
                  .map(t => [t.typname, _oidToEnumValues[t.oid]!.map(e => e.enumlabel as string)]),
              )

              _oidToTypeName = fromPairs(types.map(t => [t.oid as number, t.typname as string]))
              writeIfChanged(
                join(config.writeTypes, '_pg_types.ts'),
                [
                  `${header}`,
                  `export const _pg_types = ${inspect(_pg_types)} as const`,
                  `export type _pg_types = typeof _pg_types${EOL}`,
                ].join(EOL + EOL),
              )
            }
            return null
          },
          afterQueryExecution: async ({originalQuery}, _query, result) => {
            const trimmedSql = originalQuery.sql.replace(/^\r?\n+/, '').trimRight()
            const _identifiers = _map[mapKey(originalQuery)]
            _identifiers &&
              _identifiers.forEach(identifier =>
                writeTypes(
                  identifier,
                  result.fields.map(f => ({
                    name: f.name,
                    value: typescriptTypeName(f.dataTypeId),
                    description: _oidToTypeName && `pg_type.typname: ${_oidToTypeName[f.dataTypeId]}`,
                  })),
                  trimmedSql.trim(),
                ),
              )

            // todo: fix types and remove this stupid cast? @types/slonik seems to expect null here
            return (result as any) as null
          },
        },
      ],
      typeParsers,
    },
  }
}

export interface Property {
  name: string
  value: string
  description?: string
}
const blockComment = (str?: string) => str && '/** ' + str.replace(/\*\//g, '') + ' */'
const codegen = {
  writeInterface: (name: string, properties: Property[], description?: string) =>
    `export interface ${name} ` + codegen.writeInterfaceBody(properties, description),

  writeInterfaceBody: (properties: Property[], description?: string) =>
    [
      blockComment(description),
      `{`,
      ...properties.map(p =>
        [blockComment(p.description), `${p.name}: ${p.value}`]
          .filter(Boolean)
          .map(s => '  ' + s)
          .join(EOL),
      ),
      `}`,
    ]
      .filter(Boolean)
      .join(EOL),
}

const header = [
  '/* eslint-disable */',
  '// tslint:disable',
  `// this file is generated by a tool; don't change it manually.`,
].join(EOL)

const getFsTypeWriter = (generatedPath: string) => (typeName: string, properties: Property[], description: string) => {
  const tsPath = join(generatedPath, `${typeName}.ts`)
  const existingContent = fs.existsSync(tsPath) ? fs.readFileSync(tsPath, 'utf8') : ''
  const metaDeclaration = `export const ${typeName}_meta_v0 = `
  const lines = existingContent.split(EOL).map(line => line.trim())
  const metaLine = lines.find(line => line.startsWith(metaDeclaration)) || '[]'
  let _entries: Array<typeof newEntry> = JSON.parse(metaLine.replace(metaDeclaration, ''))

  const newEntry = {properties, description}
  _entries.unshift(newEntry)
  _entries = orderBy(_entries, e => e.description)
  _entries = _entries.filter((e, i, arr) => i === arr.findIndex(x => x.description === e.description))

  const entriesWithTypes = _entries.map(e => ({
    ...e,
    type: codegen.writeInterfaceBody(e.properties),
  }))

  const uniqueTypes = entriesWithTypes.map(e => e.type).filter((type, i, arr) => i === arr.indexOf(type))

  const backtick = '`'
  const queryLiteral = (q: string) => (q.includes(backtick) ? JSON.stringify(q) : backtick + q + backtick)

  const tsContent = [
    header,
    ``,
    `export type ${typeName}_AllTypes = [`,
    uniqueTypes
      .map(t => '  ' + t)
      .join(',' + EOL)
      .replace(/\r?\n/g, EOL + '  '),
    `]`,
    `export interface ${typeName}_QueryTypeMap {`,
    '  ' +
      entriesWithTypes
        .map(e => `[${queryLiteral(e.description)}]: ${typeName}_AllTypes[${uniqueTypes.indexOf(e.type)}]`)
        .join(EOL)
        .replace(/\r?\n/g, EOL + '  '),
    `}`,
    ``,
    `export type ${typeName}_UnionType = ${typeName}_QueryTypeMap[keyof ${typeName}_QueryTypeMap]`,
    ``,
    `export type ${typeName} = {`,
    `  [K in keyof ${typeName}_UnionType]: ${typeName}_UnionType[K]`,
    `}`,
    `export const ${typeName} = {} as ${typeName}`,
    ``,
    `${metaDeclaration}${JSON.stringify(_entries)}`,
    ``,
  ].join(EOL)

  void writeIfChanged(tsPath, tsContent)

  const knownTypes = fs
    .readdirSync(generatedPath)
    .filter(filename => filename.endsWith('.ts') && filename !== 'index.ts')
    .map(filename => basename(filename, '.ts'))

  void writeIfChanged(
    join(generatedPath, `index.ts`),
    [
      header,
      ...knownTypes.map(name => `import {${name}} from './${name}'`),
      '',
      ...knownTypes.map(name => `export {${name}}`),
      '',
      codegen.writeInterface(
        'KnownTypes',
        knownTypes.map(name => ({name, value: name})),
      ),
      '',
      '/** runtime-accessible object with phantom type information of query results. */',
      `export const knownTypes: KnownTypes = {`,
      ...knownTypes.map(name => `  ${name},`),
      `}`,
      '',
    ].join(EOL),
  )
}

const builtInTypeMappings: Record<string, string | undefined> = {
  text: 'string',
  varchar: 'string',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  bool: 'boolean',
  _text: 'string[]',
  timestamptz: 'string',
}

export const main = (argv: string[]) => {
  const setupDir = argv.slice(-1)[0]
  console.log(`setting up generated types in ${setupDir}`)
  resetCodegenDirectory(setupDir)
}
