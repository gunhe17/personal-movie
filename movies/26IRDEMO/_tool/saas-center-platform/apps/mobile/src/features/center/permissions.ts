export type Permission =
  | 'read:center'
  | 'write:center'
  | 'read:program'
  | 'write:program'
  | 'read:room'
  | 'write:room'
  | 'read:member'
  | 'write:member'
  | 'delete:member'
  | 'read:member_invitation'
  | 'write:member_invitation'
  | 'read:schedule'
  | 'write:schedule'
  | 'delete:schedule'
  | 'read:client'
  | 'write:client'
  | 'delete:client'
  | 'read:counseling'
  | 'write:counseling'
  | 'delete:counseling'
  | 'read:counseling_note'
  | 'write:counseling_note'
  | 'read:assessment_case'
  | 'write:assessment_case'
  | 'delete:assessment_case'
  | 'read:center_assessment'
  | 'write:center_assessment'
  | 'read:send_link'
  | 'write:send_link'
  | 'read:document'
  | 'write:document'
  | 'delete:document'
  | 'read:form_template'
  | 'write:form_template'
  | 'read:form_instance'
  | 'write:form_instance'
  | 'delete:form_instance'
  | 'read:role'
  | 'write:role'
  | 'read:activity_log'
  | 'read:notice'
  | 'write:notice'
  | 'read:billing'
  | 'write:billing'
  | 'delete:billing'
  | 'read:voucher'
  | 'write:voucher'
  | 'delete:voucher'
  | '*';

export type AccessLevel = 'all' | 'own';

export interface PermissionContext {
  permissions: Permission[];
  roleCode: string | null;
  memberId: string | null;
  accessLevel: AccessLevel;
}
