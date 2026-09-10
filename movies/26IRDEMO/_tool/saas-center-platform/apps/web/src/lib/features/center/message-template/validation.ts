export function linkTemplateError(
  templateType: string,
  content: string
): string {
  return templateType === 'assessment_send_link' &&
    (!content.includes('{assessment_url}') ||
      !content.includes('{verification_code}'))
    ? '바로링크와 인증번호 자동 입력 항목을 모두 포함해주세요.'
    : ''
}
