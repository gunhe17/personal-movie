import { usePermissionStore } from './permission-store';
import type { Permission } from './permissions';

export function usePermission() {
  const context = usePermissionStore((s) => s.context);
  const isLoading = usePermissionStore((s) => s.isLoading);

  const permissions = context?.permissions ?? [];
  const hasWildcard = permissions.includes('*');

  const can = (permission: Permission): boolean => {
    if (hasWildcard) return true;
    return permissions.includes(permission);
  };

  const canAny = (perms: Permission[]): boolean => {
    if (hasWildcard) return true;
    return perms.some((p) => permissions.includes(p));
  };

  const canAll = (perms: Permission[]): boolean => {
    if (hasWildcard) return true;
    return perms.every((p) => permissions.includes(p));
  };

  return {
    can,
    canAny,
    canAll,
    isLoading,
    accessLevel: context?.accessLevel ?? 'own',
    memberId: context?.memberId ?? null,
  };
}
