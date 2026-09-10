import { useCenterStore } from './store';

export type RoleCode = 'ADMIN' | 'MANAGER' | 'COUNSELOR';

export function useRole() {
  const roleCode = useCenterStore((s) => s.roleCode) as RoleCode | null;

  return {
    roleCode,
    isAdmin: roleCode === 'ADMIN',
    isManager: roleCode === 'MANAGER',
    isCounselor: roleCode === 'COUNSELOR',
    /** ADMIN 또는 MANAGER: 센터 전체 데이터 접근 */
    hasFullAccess: roleCode === 'ADMIN' || roleCode === 'MANAGER',
  };
}
