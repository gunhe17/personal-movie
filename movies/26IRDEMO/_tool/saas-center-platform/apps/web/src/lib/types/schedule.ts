export type CalendarType = '월' | '주' | '일'

export type DateSelectType =
  | { startDate: Date | null; endDate: Date | null }
  | Date
  | null

export type ScheduleFormType = {
  id: string
  tenant_profile_id: string
  work_hours: Record<string, WorkHourType>
  is_active: string
  is_default: string
  created_at: string
  updated_at: string
}

export type WorkHourType = {
  end: string
  start: string
  breaks: Omit<WorkHourType, 'breaks'>[]
}

export type RoomType = {
  id: string
  tenant_id: string
  name: string
  location: string
  status: string
  capacity: number
  memo: string
  created_at: string
  updated_at: string
}
