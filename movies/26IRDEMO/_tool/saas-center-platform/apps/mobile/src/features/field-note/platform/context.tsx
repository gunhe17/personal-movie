/**
 * 필드노트 플랫폼 포트의 React context.
 *
 * 코어 컴포넌트/훅은 `useFieldNotePlatform()`으로 주입된 플랫폼 의존성을 읽는다.
 * Provider 는 호스트 앱이 마운트한다(메인 앱: `platform/mainApp.tsx`).
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { FieldNotePlatform } from './types';

const FieldNotePlatformContext = createContext<FieldNotePlatform | null>(null);

export function FieldNotePlatformProvider({
  value,
  children,
}: {
  value: FieldNotePlatform;
  children: ReactNode;
}) {
  return (
    <FieldNotePlatformContext.Provider value={value}>
      {children}
    </FieldNotePlatformContext.Provider>
  );
}

export function useFieldNotePlatform(): FieldNotePlatform {
  const ctx = useContext(FieldNotePlatformContext);
  if (!ctx) {
    throw new Error(
      'useFieldNotePlatform 은 FieldNotePlatformProvider 안에서만 사용할 수 있어요.',
    );
  }
  return ctx;
}
