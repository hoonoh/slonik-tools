import {GdescriberParams} from '../types'
import * as fs from 'fs'
import * as path from 'path'
import {pascalCase} from '../util'

// todo: use this to generate a command getter:
// `sql.file('type/checked/relative/path/to/file.sql', values: [type, checked, variables, too])`
// or does that belong in a separate lib? I like it here I think.
export const extractSQLFile: GdescriberParams['extractQueries'] = file => {
  return [
    {
      file,
      sql: fs.readFileSync(file).toString(),
      tag: pascalCase(path.parse(file).name),
    },
  ]
}
