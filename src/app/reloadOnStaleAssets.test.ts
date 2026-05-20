import { describe, expect, it } from 'vitest'
import { isStaleAssetError } from './reloadOnStaleAssets'

describe('stale asset detection', () => {
  it('detects dynamic import failures from stale deployments', () => {
    expect(
      isStaleAssetError(
        new TypeError('Failed to fetch dynamically imported module'),
      ),
    ).toBe(true)
    expect(
      isStaleAssetError("'text/html' is not a valid JavaScript MIME type."),
    ).toBe(true)
  })

  it('does not classify unrelated runtime errors as stale assets', () => {
    expect(isStaleAssetError(new Error('Cannot read properties of null'))).toBe(
      false,
    )
  })
})
