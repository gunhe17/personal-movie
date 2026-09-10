import { describe, expect, it } from 'vitest'
import { linkTemplateError } from './validation'
import { ACTIVE_TEMPLATE_TYPE_OPTIONS } from './constants'
import { getVariableLabelMap } from './constants'
import { contentToDisplay, displayToContent } from './view-model'

describe('link template settings', () => {
  it('keeps stored variables and old Korean tags compatible with the new label', () => {
    const labels = getVariableLabelMap('assessment_send_link')
    expect(contentToDisplay('{assessment_url}', labels)).toBe('#{바로링크}')
    expect(displayToContent('#{검사 링크} #{바로링크}', labels)).toBe(
      '{assessment_url} {assessment_url}'
    )
  })
  it('exposes the link type in settings and create options', () => {
    expect(
      ACTIVE_TEMPLATE_TYPE_OPTIONS.some(
        (option) => option.value === 'assessment_send_link'
      )
    ).toBe(true)
  })
  it('requires both link variables without restricting other template types', () => {
    expect(
      linkTemplateError('assessment_send_link', '{assessment_url}')
    ).not.toBe('')
    expect(
      linkTemplateError('assessment_send_link', '{verification_code}')
    ).not.toBe('')
    expect(
      linkTemplateError(
        'assessment_send_link',
        '{assessment_url} {verification_code}'
      )
    ).toBe('')
    expect(linkTemplateError('invoice_issued', '청구 안내')).toBe('')
  })
})
