import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function dryRunHarnessUrl(filename: string): string {
  const [pathPart, queryPart] = filename.split('?')
  const filePath = resolve(process.cwd(), 'tests', 'e2e', 'harness', pathPart)
  const url = pathToFileURL(filePath).href
  return queryPart ? `${url}?${queryPart}` : url
}
