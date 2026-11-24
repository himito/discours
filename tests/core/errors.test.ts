import { describe, expect, it } from 'vitest'
import { errorMessage } from '#core/errors'

describe('errorMessage', () => {
  it('gives the message of an Error', () => {
    expect(errorMessage(new TypeError('boom'))).toBe('boom')
  })

  it('gives any other thrown value as text', () => {
    expect(errorMessage('offline')).toBe('offline')
    expect(errorMessage(404)).toBe('404')
  })
})
