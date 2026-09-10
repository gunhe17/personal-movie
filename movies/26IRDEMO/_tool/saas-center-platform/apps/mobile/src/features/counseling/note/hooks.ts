import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import {
  getNotesBySession,
  getNoteById,
  getMyNotes,
  createNote,
  updateNote,
  deleteNote,
} from './api';
import type {
  CounselingNoteCreateRequest,
  CounselingNoteUpdateRequest,
  MyNotesStatus,
} from './types';

/** 회기별 노트 목록 조회 */
export function useNotesBySession(
  centerId: string | null,
  sessionId: string | null,
  clientId?: string,
) {
  return useQuery({
    queryKey: ['counselingNotes', centerId, sessionId, clientId],
    queryFn: () => getNotesBySession(centerId!, sessionId!, clientId),
    enabled: !!centerId && !!sessionId,
  });
}

/** 노트 단일 조회 */
export function useNoteById(centerId: string | null, noteId: string | null) {
  return useQuery({
    queryKey: ['counselingNote', centerId, noteId],
    queryFn: () => getNoteById(centerId!, noteId!),
    enabled: !!centerId && !!noteId,
  });
}

/** 상담일지 무한스크롤 페이지 크기 */
export const MY_NOTES_PAGE_SIZE = 30;

/**
 * 내 상담일지 목록 무한스크롤 조회 (작성/미작성/전체).
 * status·내담자명(keyword) 모두 서버 측 처리 — 내담자 목록과 동일 패턴.
 */
export function useInfiniteMyNotes(
  centerId: string | null,
  options: { status?: MyNotesStatus; keyword?: string } = {},
) {
  const { status = 'all', keyword } = options;
  return useInfiniteQuery({
    queryKey: ['myCounselingNotes', centerId, status, keyword ?? ''],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getMyNotes(centerId!, {
        status,
        keyword: keyword || undefined,
        skip: pageParam,
        limit: MY_NOTES_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: !!centerId,
  });
}

/** 노트 생성 */
export function useCreateNote(centerId: string | null, sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CounselingNoteCreateRequest) =>
      createNote(centerId!, sessionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['counselingNotes', centerId, sessionId],
      });
      queryClient.invalidateQueries({
        queryKey: ['myCounselingNotes'],
        exact: false,
      });
    },
  });
}

/** 노트 수정 */
export function useUpdateNote(centerId: string | null, noteId: string | null, sessionId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CounselingNoteUpdateRequest) =>
      updateNote(centerId!, noteId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['counselingNote', centerId, noteId],
      });
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: ['counselingNotes', centerId, sessionId],
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['myCounselingNotes'],
        exact: false,
      });
    },
  });
}

/** 노트 삭제 */
export function useDeleteNote(centerId: string | null, sessionId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => deleteNote(centerId!, noteId),
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: ['counselingNotes', centerId, sessionId],
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['counselingNote'],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ['myCounselingNotes'],
        exact: false,
      });
    },
  });
}
