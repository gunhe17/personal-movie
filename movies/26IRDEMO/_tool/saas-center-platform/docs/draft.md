### Domain: Person

### Domain Overview

- Role: 사람 (Staff / Client / Parent) 기본 정보
- Table: `persons`
- Note: 직접 API 없음 (Composite 통해 생성)

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| name | str | Y | Name |
| birth | str (YYYY-MM-DD) | Y | Birth Date |
| phone | str | Y | Phone |
| gender | enum | Y | MALE / FEMALE |
| metadata | dict | N | Extra Metadata |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| - | - | No Direct API | - |

### Table Relations

```
persons (1) ──── (0..1) accounts
persons (1) ──── (N) center_memberships
persons (1) ──── (N) resource_relations
```

---

### Domain: Account

### Domain Overview

- Role: 로그인 계정
- Table: `accounts`

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| person_id | UUID (FK) | Y | FK → persons |
| email | str | Y | Email |
| email_verified | bool | Y | Verified Flag |
| password_hash | str | Y | Password Hash |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| POST | /auth/login | Login | auth:login |

### Table Relations

```
accounts (1) ──── (1) persons
```

---

### Domain: Center

### Domain Overview

- Role: 센터/치료소 정보
- Table: `centers`

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| tenant_id | UUID (FK) | Y | Tenant ID |
| name | str | Y | Center Name |
| address | dict | Y | base_address / detail_address / postal_code |
| business_registration_number | str | Y | Business No |
| representative_name | str | Y | Representative |
| contact | str | Y | Contact |
| password | str | Y | Center Password |
| status | enum | Y | PENDING / ACTIVE / SUSPENDED / REJECTED |
| created_by | UUID (FK) | Y | Creator |
| logo_url | str | N | Logo URL |
| bank_account | dict | N | Bank Info |
| approved_at | datetime | N | Approved At |
| approved_by | UUID (FK) | N | Approver |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| POST | /center | Create | center:create |
| GET | /center/{center_id} | Retrieve | center:read |
| PATCH | /center/{center_id} | Update | center:update |

### Table Relations

```
centers (1) ──── (N) center_memberships
centers (1) ──── (N) programs
centers (1) ──── (N) rooms
centers (1) ──── (N) permission_policies
centers (1) ──── (N) center_operating_hours
centers (1) ──── (N) center_holidays
centers (1) ──── (N) specialist_work_hours
centers (1) ──── (N) specialist_work_exceptions
```

---

### Domain: CenterMembership

### Domain Overview

- Role: Person ↔ Center 소속 관계
- Table: `center_memberships`
- Note: 직접 API 없음 (Composite 통해 생성)

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| person_id | UUID (FK) | Y | FK → persons |
| center_id | UUID (FK) | Y | FK → centers |
| role | enum | Y | CENTER / MANAGER / SPECIALIST / PARENT / CLIENT |
| permission_policy_id | UUID (FK) | Y | FK → permission_policies |
| effective_from | datetime | Y | Effective From |
| employment_type | enum | N | FULLTIME / CONTRACT / FREELANCER |
| memo | str | N | Memo |
| metadata | dict | N | Extra Metadata |
| effective_to | datetime | N | Effective To |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| - | - | No Direct API | - |

### Table Relations

```
center_memberships (N) ──── (1) persons
center_memberships (N) ──── (1) centers
center_memberships (N) ──── (1) permission_policies
```

---

### Domain: PermissionPolicy

### Domain Overview

- Role: 권한 정책 (ABAC style JSON)
- Table: `permission_policies`
- Note: 현재 API 없음 (CLI로 생성)

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| center_id | UUID (FK) | Y | FK → centers |
| policy_name | str | Y | Policy Name |
| policy_type | enum | Y | SYSTEM / CUSTOM |
| policy_document | dict (JSON) | Y | Policy Document |
| version | int | Y | Version (default: 1) |
| is_active | bool | Y | Active Flag |
| created_by | UUID (FK) | N | Creator |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| - | - | No API (CLI only) | - |

### Table Relations

```
permission_policies (N) ──── (1) centers
permission_policies (1) ──── (N) center_memberships
```

---

### Domain: Program

### Domain Overview

- Role: 치료 프로그램
- Table: `programs`

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| center_id | UUID (FK) | Y | FK → centers |
| name | str | Y | Program Name |
| price | int | Y | Price (KRW) |
| duration_minutes | int | Y | Duration |
| program_type | enum | Y | INDIVIDUAL / GROUP |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| POST | /program | Create | program:create |
| GET | /program/{program_id} | Retrieve | program:read |
| PATCH | /program/{program_id} | Update | program:update |

### Table Relations

```
programs (N) ──── (1) centers
resource_relations (N) ──── (1) programs   (resource_type=... when applicable)
```

---

### Domain: Room

### Domain Overview

- Role: 상담실
- Table: `rooms`

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| center_id | UUID (FK) | Y | FK → centers |
| name | str | Y | Room Name |
| description | str | N | Description |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| POST | /room | Create | room:create |
| GET | /room/{room_id} | Retrieve | room:read |
| PATCH | /room/{room_id} | Update | room:update |

### Table Relations

```
rooms (N) ──── (1) centers
```

---

### Domain: ResourceRelation

### Domain Overview

- Role: Person ↔ Resource 관계 (예: 보호자-내담자, 담당 배정)
- Table: `resource_relations`

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| person_id | UUID (FK) | Y | FK → persons |
| resource_id | UUID (FK) | Y | Resource ID |
| resource_type | enum | Y | CHILD / ASSESSMENT |
| relation_type | enum | Y | ASSIGNED / PARENT / GUARDIAN |
| effective_from | datetime | Y | Effective From |
| metadata | dict | N | Extra Metadata |
| effective_to | datetime | N | Effective To |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| POST | /client/{client_id}/parent | Link Parent | client:link_parent |
| GET | /client/{client_id}/parent | Read Parent | client:read_parent |

### Table Relations

```
resource_relations (N) ──── (1) persons
resource_relations (N) ──── (1) resources (polymorphic by resource_type/resource_id)
```

---

### Domain: CenterOperatingHour

### Domain Overview

- Role: 센터 영업시간 (요일별)
- Table: `center_operating_hours`
- Note: 현재 API 없음 (Center 생성 시 함께 생성)

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| center_id | UUID (FK) | Y | FK → centers |
| day_of_week | int | Y | 0=Mon ... 6=Sun |
| is_closed | bool | Y | Closed Flag |
| updated_by | UUID (FK) | Y | Updater |
| open_time | str (HH:MM) | N | Open Time |
| close_time | str (HH:MM) | N | Close Time |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| - | - | No API | - |

### Table Relations

```
center_operating_hours (N) ──── (1) centers
center_operating_hours (1) ──── (N) center_break_times
```

---

### Domain: CenterBreakTime

### Domain Overview

- Role: 센터 휴식시간
- Table: `center_break_times`
- Note: 현재 API 없음

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| operating_hour_id | UUID (FK) | Y | FK → center_operating_hours |
| start_time | str (HH:MM) | Y | Start |
| end_time | str (HH:MM) | Y | End |
| reason | str | N | Reason |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| - | - | No API | - |

### Table Relations

```
center_break_times (N) ──── (1) center_operating_hours
```

---

### Domain: CenterHoliday

### Domain Overview

- Role: 센터 휴일
- Table: `center_holidays`
- Note: 현재 API 없음

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| center_id | UUID (FK) | Y | FK → centers |
| date_from | str (YYYY-MM-DD) | Y | From |
| date_to | str (YYYY-MM-DD) | Y | To |
| is_auto_generated | bool | Y | Auto Generated |
| created_by | UUID (FK) | Y | Creator |
| reason | str | N | Reason |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| - | - | No API | - |

### Table Relations

```
center_holidays (N) ──── (1) centers
```

---

### Domain: SpecialistWorkHour

### Domain Overview

- Role: 전문가 근무시간 (요일별)
- Table: `specialist_work_hours`
- Note: 현재 API 없음

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| specialist_id | UUID (FK) | Y | Specialist(Person) |
| center_id | UUID (FK) | Y | FK → centers |
| day_of_week | int | Y | 0=Mon ... 6=Sun |
| is_working | bool | Y | Working Flag |
| updated_by | UUID (FK) | Y | Updater |
| start_time | str (HH:MM) | N | Start |
| end_time | str (HH:MM) | N | End |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| - | - | No API | - |

### Table Relations

```
specialist_work_hours (N) ──── (1) persons (specialist_id)
specialist_work_hours (N) ──── (1) centers
```

---

### Domain: SpecialistWorkException

### Domain Overview

- Role: 전문가 근무 예외 (특정 날짜)
- Table: `specialist_work_exceptions`
- Note: 현재 API 없음

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| specialist_id | UUID (FK) | Y | Specialist(Person) |
| center_id | UUID (FK) | Y | FK → centers |
| date | str (YYYY-MM-DD) | Y | Date |
| is_working | bool | Y | Working Flag |
| created_by | UUID (FK) | Y | Creator |
| start_time | str (HH:MM) | N | Start |
| end_time | str (HH:MM) | N | End |
| reason | str | N | Reason |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| - | - | No API | - |

### Table Relations

```
specialist_work_exceptions (N) ──── (1) persons (specialist_id)
specialist_work_exceptions (N) ──── (1) centers
```

---

### Domain: Staff

### Domain Overview

- Role: 직원 Composite (Person + CenterMembership + Account)
- Roles: CENTER / MANAGER / SPECIALIST
- Table: Composite (no single table)

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| person | Person | Y | Base Person |
| membership | CenterMembership | Y | Role + Policy |
| account | Account | N | Login (if provisioned) |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| POST | /staff | Create | staff:create |
| GET | /staff/{staff_id} | Retrieve | staff:read |
| GET | /staff | List | staff:list |
| PATCH | /staff/{staff_id} | Update | staff:update |

### Table Relations

```
staff == persons + center_memberships (+ accounts)
```

---

### Domain: Client

### Domain Overview

- Role: 내담자 Composite (Person + CenterMembership)
- Roles: CLIENT
- Table: Composite (no single table)

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| person | Person | Y | Base Person |
| membership | CenterMembership | Y | role=CLIENT |
| relations | ResourceRelation | N | parent linkage via resource_relations |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| POST | /client | Create | client:create |
| GET | /client/{client_id} | Retrieve | client:read |
| GET | /client | List | client:list |
| POST | /client/{client_id}/parent | Link Parent | client:link_parent |
| GET | /client/{client_id}/parent | Read Parent | client:read_parent |

### Table Relations

```
client == persons + center_memberships (+ resource_relations)
```

---

### Domain: Parent

### Domain Overview

- Role: 보호자 Composite (Person + CenterMembership)
- Roles: PARENT
- Table: Composite (no single table)

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| person | Person | Y | Base Person |
| membership | CenterMembership | Y | role=PARENT |

### API

| Method | Path | Description | Action |
| --- | --- | --- | --- |
| POST | /parent | Create | parent:create |
| GET | /parent/{parent_id} | Retrieve | parent:read |
| GET | /parent | List | parent:list |

### Table Relations

```
parent == persons + center_memberships
```