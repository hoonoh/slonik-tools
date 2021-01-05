import * as fsSyncer from 'fs-syncer'
import * as gdesc from '../src/gdesc'
import {getPoolHelper} from '@slonik/migrator/test/pool-helper'

const helper = getPoolHelper({__filename})

const gdescParams = (baseDir: string): Partial<gdesc.GdescriberParams> => ({
  rootDir: baseDir,
  pool: helper.pool,
  psqlCommand: `docker-compose exec -T postgres psql "postgresql://postgres:postgres@localhost:5432/postgres?options=--search_path%3d${helper.schemaName}"`,
})

beforeEach(async () => {
  await helper.pool.query(helper.sql`
    create table test_table(
      id int primary key,
      n int
    );
  `)
})

test('edit before write', async () => {
  const syncer = fsSyncer.jest.jestFixture({
    'test-table1.sql': `select id, n from test_table`,
    'test-table2.sql': `select n as aaa from test_table`,
  })

  syncer.sync()

  await gdesc.gdescriber(gdescParams(syncer.baseDir))

  expect(syncer.yaml()).toMatchInlineSnapshot(`
    "---
    test-table1.sql: |-
      select id, n from test_table
      
    test-table2.sql: |-
      select n as aaa from test_table
      
    __sql__: 
      test-table1.sql.ts: |-
        import {TaggedTemplateLiteralInvocationType} from 'slonik'
        import * as path from 'path'
        import * as fs from 'fs'
        
        /** - query: \`select id, n from test_table\` */
        export interface TestTable1 {
          /** column: \`sql_test.test_table.id\`, not null: \`true\`, postgres type: \`integer\` */
          id: number
        
          /** column: \`sql_test.test_table.n\`, postgres type: \`integer\` */
          n: number | null
        }
        
        /**
         * Helper which reads the file system synchronously to get a query object for ../test-table1.sql.
         * (query: \`select id, n from test_table\`)
         *
         * Uses \`fs\` by default and caches the result so the disk is only accessed once. You can pass in a custom \`readFileSync\` function for use-cases where disk access is not possible.
         *
         * @example
         * \`\`\`
         * import {createPool} from 'slonik'
         * import {getTestTable1QuerySync} from './path/to/test-table1.sql'
         *
         * async function () {
         *   const pool = createPool('...connection string...')
         *
         *   const result = await pool.query(getTestTable1QuerySync())
         *
         *   return result.rows.map(r => [r.id, r.n])
         * }
         * \`\`\`
         */
        export const getTestTable1QuerySync = ({
          readFileSync = defaultReadFileSync,
        }: GetTestTable1QuerySyncParams = {}): TaggedTemplateLiteralInvocationType<TestTable1> => ({
          sql: readFileSync(sqlPath).toString(),
          type: 'SLONIK_TOKEN_SQL',
          values: [],
        })
        
        /**
         * Helper which reads the file system asynchronously to get a query object for ../test-table1.sql.
         * (query: \`select id, n from test_table\`)
         *
         * Uses \`fs\` by default and caches the result so the disk is only accessed once. You can pass in a custom \`readFile\` function for use-cases where disk access is not possible.
         *
         * @example
         * \`\`\`
         * import {createPool} from 'slonik'
         * import {getTestTable1QueryAasync} from './path/to/test-table1.sql'
         *
         * aasync function () {
         *   const pool = createPool('...connection string...')
         *
         *   const result = await pool.query(getTestTable1QueryAasync())
         *
         *   return result.rows.map(r => [r.id, r.n])
         * }
         * \`\`\`
         */
        export const getTestTable1QueryAync = async ({
          readFile = defaultReadFileAsync,
        }: GetTestTable1QueryAsyncParams = {}): Promise<TaggedTemplateLiteralInvocationType<TestTable1>> => ({
          sql: (await readFile(sqlPath)).toString(),
          type: 'SLONIK_TOKEN_SQL',
          values: [],
        })
        const sqlPath = path.join(__dirname, '../test-table1.sql')
        
        export interface GetTestTable1QueryParams {}
        
        export interface FileContent {
          toString(): string
        }
        
        export interface GetTestTable1QuerySyncParams extends GetTestTable1QueryParams {
          readFileSync?: (filepath: string) => FileContent
        }
        
        export interface GetTestTable1QueryAsyncParams extends GetTestTable1QueryParams {
          readFile?: (filepath: string) => Promise<FileContent>
        }
        
        export const _queryCache = new Map<string, string>()
        
        export const defaultReadFileSync: GetTestTable1QuerySyncParams['readFileSync'] = (filepath: string) => {
          const cached = _queryCache.get(filepath)
          if (cached) {
            return cached
          }
          const content = fs.readFileSync(filepath).toString()
          _queryCache.set(filepath, content)
          return content
        }
        
        export const defaultReadFileAsync: GetTestTable1QueryAsyncParams['readFile'] = async (filepath: string) => {
          const cached = _queryCache.get(filepath)
          if (cached) {
            return cached
          }
          const content = (await fs.promises.readFile(filepath)).toString()
          _queryCache.set(filepath, content)
          return content
        }
        
      test-table2.sql.ts: |-
        import {TaggedTemplateLiteralInvocationType} from 'slonik'
        import * as path from 'path'
        import * as fs from 'fs'
        
        /** - query: \`select n as aaa from test_table\` */
        export interface TestTable2 {
          /** column: \`sql_test.test_table.n\`, postgres type: \`integer\` */
          aaa: number | null
        }
        
        /**
         * Helper which reads the file system synchronously to get a query object for ../test-table2.sql.
         * (query: \`select n as aaa from test_table\`)
         *
         * Uses \`fs\` by default and caches the result so the disk is only accessed once. You can pass in a custom \`readFileSync\` function for use-cases where disk access is not possible.
         *
         * @example
         * \`\`\`
         * import {createPool} from 'slonik'
         * import {getTestTable2QuerySync} from './path/to/test-table2.sql'
         *
         * async function () {
         *   const pool = createPool('...connection string...')
         *
         *   const result = await pool.query(getTestTable2QuerySync())
         *
         *   return result.rows.map(r => [r.aaa])
         * }
         * \`\`\`
         */
        export const getTestTable2QuerySync = ({
          readFileSync = defaultReadFileSync,
        }: GetTestTable2QuerySyncParams = {}): TaggedTemplateLiteralInvocationType<TestTable2> => ({
          sql: readFileSync(sqlPath).toString(),
          type: 'SLONIK_TOKEN_SQL',
          values: [],
        })
        
        /**
         * Helper which reads the file system asynchronously to get a query object for ../test-table2.sql.
         * (query: \`select n as aaa from test_table\`)
         *
         * Uses \`fs\` by default and caches the result so the disk is only accessed once. You can pass in a custom \`readFile\` function for use-cases where disk access is not possible.
         *
         * @example
         * \`\`\`
         * import {createPool} from 'slonik'
         * import {getTestTable2QueryAasync} from './path/to/test-table2.sql'
         *
         * aasync function () {
         *   const pool = createPool('...connection string...')
         *
         *   const result = await pool.query(getTestTable2QueryAasync())
         *
         *   return result.rows.map(r => [r.aaa])
         * }
         * \`\`\`
         */
        export const getTestTable2QueryAync = async ({
          readFile = defaultReadFileAsync,
        }: GetTestTable2QueryAsyncParams = {}): Promise<TaggedTemplateLiteralInvocationType<TestTable2>> => ({
          sql: (await readFile(sqlPath)).toString(),
          type: 'SLONIK_TOKEN_SQL',
          values: [],
        })
        const sqlPath = path.join(__dirname, '../test-table2.sql')
        
        export interface GetTestTable2QueryParams {}
        
        export interface FileContent {
          toString(): string
        }
        
        export interface GetTestTable2QuerySyncParams extends GetTestTable2QueryParams {
          readFileSync?: (filepath: string) => FileContent
        }
        
        export interface GetTestTable2QueryAsyncParams extends GetTestTable2QueryParams {
          readFile?: (filepath: string) => Promise<FileContent>
        }
        
        export const _queryCache = new Map<string, string>()
        
        export const defaultReadFileSync: GetTestTable2QuerySyncParams['readFileSync'] = (filepath: string) => {
          const cached = _queryCache.get(filepath)
          if (cached) {
            return cached
          }
          const content = fs.readFileSync(filepath).toString()
          _queryCache.set(filepath, content)
          return content
        }
        
        export const defaultReadFileAsync: GetTestTable2QueryAsyncParams['readFile'] = async (filepath: string) => {
          const cached = _queryCache.get(filepath)
          if (cached) {
            return cached
          }
          const content = (await fs.promises.readFile(filepath)).toString()
          _queryCache.set(filepath, content)
          return content
        }
        "
  `)
}, 20000)

test('sql with parameters', async () => {
  const syncer = fsSyncer.jest.jestFixture({
    'test-table.sql': `select id, n from test_table where id = $1 and n = $2`,
  })

  syncer.sync()

  await gdesc.gdescriber(gdescParams(syncer.baseDir))

  expect(syncer.yaml()).toMatchInlineSnapshot(`
    "---
    test-table.sql: |-
      select id, n from test_table where id = $1 and n = $2
      
    __sql__: 
      test-table.sql.ts: |-
        import {TaggedTemplateLiteralInvocationType} from 'slonik'
        import * as path from 'path'
        import * as fs from 'fs'
        
        /** - query: \`select id, n from test_table where id = $1 and n = $2\` */
        export interface TestTable {
          /** postgres type: \`integer\` */
          id: number | null
        
          /** postgres type: \`integer\` */
          n: number | null
        }
        
        /**
         * Helper which reads the file system synchronously to get a query object for ../test-table.sql.
         * (query: \`select id, n from test_table where id = $1 and n = $2\`)
         *
         * Uses \`fs\` by default and caches the result so the disk is only accessed once. You can pass in a custom \`readFileSync\` function for use-cases where disk access is not possible.
         *
         * @example
         * \`\`\`
         * import {createPool} from 'slonik'
         * import {getTestTableQuerySync} from './path/to/test-table.sql'
         *
         * async function () {
         *   const pool = createPool('...connection string...')
         *
         *   const result = await pool.query(getTestTableQuerySync())
         *
         *   return result.rows.map(r => [r.id, r.n])
         * }
         * \`\`\`
         */
        export const getTestTableQuerySync = ({
          readFileSync = defaultReadFileSync,
          values,
        }: GetTestTableQuerySyncParams): TaggedTemplateLiteralInvocationType<TestTable> => ({
          sql: readFileSync(sqlPath).toString(),
          type: 'SLONIK_TOKEN_SQL',
          values,
        })
        
        /**
         * Helper which reads the file system asynchronously to get a query object for ../test-table.sql.
         * (query: \`select id, n from test_table where id = $1 and n = $2\`)
         *
         * Uses \`fs\` by default and caches the result so the disk is only accessed once. You can pass in a custom \`readFile\` function for use-cases where disk access is not possible.
         *
         * @example
         * \`\`\`
         * import {createPool} from 'slonik'
         * import {getTestTableQueryAasync} from './path/to/test-table.sql'
         *
         * aasync function () {
         *   const pool = createPool('...connection string...')
         *
         *   const result = await pool.query(getTestTableQueryAasync())
         *
         *   return result.rows.map(r => [r.id, r.n])
         * }
         * \`\`\`
         */
        export const getTestTableQueryAync = async ({
          readFile = defaultReadFileAsync,
          values,
        }: GetTestTableQueryAsyncParams): Promise<TaggedTemplateLiteralInvocationType<TestTable>> => ({
          sql: (await readFile(sqlPath)).toString(),
          type: 'SLONIK_TOKEN_SQL',
          values,
        })
        const sqlPath = path.join(__dirname, '../test-table.sql')
        
        export interface GetTestTableQueryParams {
          values: [number, number]
        }
        
        export interface FileContent {
          toString(): string
        }
        
        export interface GetTestTableQuerySyncParams extends GetTestTableQueryParams {
          readFileSync?: (filepath: string) => FileContent
        }
        
        export interface GetTestTableQueryAsyncParams extends GetTestTableQueryParams {
          readFile?: (filepath: string) => Promise<FileContent>
        }
        
        export const _queryCache = new Map<string, string>()
        
        export const defaultReadFileSync: GetTestTableQuerySyncParams['readFileSync'] = (filepath: string) => {
          const cached = _queryCache.get(filepath)
          if (cached) {
            return cached
          }
          const content = fs.readFileSync(filepath).toString()
          _queryCache.set(filepath, content)
          return content
        }
        
        export const defaultReadFileAsync: GetTestTableQueryAsyncParams['readFile'] = async (filepath: string) => {
          const cached = _queryCache.get(filepath)
          if (cached) {
            return cached
          }
          const content = (await fs.promises.readFile(filepath)).toString()
          _queryCache.set(filepath, content)
          return content
        }
        "
  `)
}, 20000)
