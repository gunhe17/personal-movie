export type NoticeCategory = 'maintenance' | 'update' | 'announcement';

export interface NoticeAttachment {
  url: string;
  path: string;
  name: string;
  size: number;
  content_type: string;
}

export interface NoticeItem {
  id: string;
  title: string;
  category: NoticeCategory;
  is_published: boolean;
  is_pinned: boolean;
  is_read: boolean;
  published_at: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoticeListResponse {
  items: NoticeItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface NoticeSiblingItem {
  id: string;
  title: string;
}

export interface NoticeDetail {
  id: string;
  title: string;
  content: string;
  category: NoticeCategory;
  is_published: boolean;
  is_pinned: boolean;
  published_at: string | null;
  created_by: string;
  created_by_name: string | null;
  attachments: NoticeAttachment[] | null;
  siblings: { prev: NoticeSiblingItem | null; next: NoticeSiblingItem | null };
  created_at: string;
  updated_at: string;
}
