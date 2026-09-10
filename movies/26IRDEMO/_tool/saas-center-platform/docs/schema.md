## ActivityLog 도메인

---

domain: activity_logs
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

actor_id
varchar(36) (FK → members.id)
members 연결
@db/not null

actor_name
varchar(100)
...
@db/nullable

category
varchar(50)
...
@db/not null

action
varchar(30)
...
@db/not null

entity_type
varchar(50)
...
@db/not null

entity_id
varchar(36)
...
@db/not null

summary
text
...
@db/not null

ip_address
varchar(45)
...
@db/nullable

user_agent
text
...
@db/nullable

extra
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Agent 도메인

---

domain: agent_conversations
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

member_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

title
varchar(200)
...
@db/nullable

meta
jsonb
...
@db/nullable

display_plan
jsonb
...
@db/nullable

vars
jsonb
...
@db/nullable

status
varchar(20)
...
@db/not null, index, default=active

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: agent_messages
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

conversation_id
varchar(36) (FK → agent_conversations.id)
agent_conversations 연결
@db/nullable, index

role
varchar(20)
...
@db/not null

content
text
...
@db/nullable

display_message
jsonb
...
@db/nullable

message_type
varchar(20)
...
@db/nullable

sequence
integer
...
@db/not null, default=0

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: agent_prompts
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

key
varchar(100)
...
@db/not null

version
integer
...
@db/not null, default=1

content
text
...
@db/not null

description
text
...
@db/nullable

is_active
boolean
...
@db/not null, default=False

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: agent_runs
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

conversation_id
varchar(36) (FK → agent_conversations.id)
agent_conversations 연결
@db/not null, index

agent_name
varchar(100)
...
@db/nullable

run_type
varchar(20)
...
@db/nullable

status
varchar(20)
...
@db/not null, default=running

input_data
jsonb
...
@db/nullable

output_data
jsonb
...
@db/nullable

llm_call_id
varchar(36) (FK → llm_calls.id)
llm_calls 연결
@db/nullable

sequence
integer
...
@db/not null

parallel_group
varchar(36)
...
@db/nullable

latency_ms
float
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## AiLab 도메인

---

domain: lab_experiment_groups
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

sample_id
varchar(36) (FK → lab_sample_datasets.id)
lab_sample_datasets 연결
@db/not null

best_run_id
varchar(36) (FK → lab_experiment_runs.id)
lab_experiment_runs 연결
@db/nullable

cheapest_run_id
varchar(36) (FK → lab_experiment_runs.id)
lab_experiment_runs 연결
@db/nullable

fastest_run_id
varchar(36) (FK → lab_experiment_runs.id)
lab_experiment_runs 연결
@db/nullable

author_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

experiment_type
varchar(30)
...
@db/not null, index

status
varchar(20)
...
@db/not null, default=pending

name
varchar(200)
...
@db/not null

tags
varchar(500)
...
@db/nullable

total_runs
integer
...
@db/not null, default=0

completed_runs
integer
...
@db/not null, default=0

failed_runs
integer
...
@db/not null, default=0

total_cost_usd
float
...
@db/nullable

avg_latency_ms
integer
...
@db/nullable

started_at
datetime
...
@db/nullable

completed_at
datetime
...
@db/nullable

description
text
...
@db/nullable

memo
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: lab_experiment_runs
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

field_note_id
varchar(36) (FK → field_notes.id)
field_notes 연결
@db/nullable, index

field_note_audio_id
varchar(36) (FK → field_note_audios.id)
field_note_audios 연결
@db/nullable

sample_id
varchar(36) (FK → lab_sample_datasets.id)
lab_sample_datasets 연결
@db/nullable, index

group_id
varchar(36) (FK → lab_experiment_groups.id)
lab_experiment_groups 연결
@db/nullable, index

prompt_version_id
varchar(36) (FK → lab_prompt_versions.id)
lab_prompt_versions 연결
@db/nullable

author_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

experiment_type
varchar(30)
...
@db/not null, index

status
varchar(20)
...
@db/not null, default=pending

model_name
varchar(80)
...
@db/not null

provider
varchar(30)
...
@db/not null, default=openai

tags
varchar(500)
...
@db/nullable

latency_ms
integer
...
@db/nullable

input_tokens
integer
...
@db/nullable

output_tokens
integer
...
@db/nullable

total_tokens
integer
...
@db/nullable

estimated_cost_usd
float
...
@db/nullable

input_audio_duration
float
...
@db/nullable

quality_score
integer
...
@db/nullable

started_at
datetime
...
@db/nullable

completed_at
datetime
...
@db/nullable

model_params
text
...
@db/nullable

output_json
text
...
@db/nullable

error_message
text
...
@db/nullable

input_text
text
...
@db/nullable

output_text
text
...
@db/nullable

memo
text
...
@db/nullable

quality_note
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: lab_prompt_versions
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

author_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

name
varchar(200)
...
@db/not null

prompt_key
varchar(50)
...
@db/not null, index

version
integer
...
@db/not null

is_active
boolean
...
@db/not null, default=True

is_production
boolean
...
@db/not null, default=False

system_prompt
text
...
@db/not null

user_prompt_template
text
...
@db/nullable

description
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: lab_sample_datasets
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

field_note_id
varchar(36) (FK → field_notes.id)
field_notes 연결
@db/nullable, index

author_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

input_type
varchar(20)
...
@db/not null, index

source_type
varchar(30)
...
@db/nullable

name
varchar(200)
...
@db/not null

s3_key
varchar(500)
...
@db/nullable

tags
varchar(500)
...
@db/nullable

audio_duration
float
...
@db/nullable

audio_file_size
integer
...
@db/nullable

usage_count
integer
...
@db/not null, default=0

last_used_at
datetime
...
@db/nullable

description
text
...
@db/nullable

text_content
text
...
@db/nullable

reference_segments
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: production_ai_configs
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

promoted_from_version_id
varchar(36) (FK → lab_prompt_versions.id)
lab_prompt_versions 연결
@db/nullable

promoted_by
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/nullable

model_name
varchar(80)
...
@db/not null

module
varchar(30)
...
@db/not null, default=field_note

pipeline_step
varchar(50)
...
@db/not null

provider
varchar(30)
...
@db/not null, default=openai

diarization_strategy
varchar(20)
...
@db/nullable

promoted_at
datetime
...
@db/nullable

is_active
boolean
...
@db/not null, default=True

model_params
text
...
@db/nullable

system_prompt
text
...
@db/nullable

user_prompt_template
text
...
@db/nullable

description
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Assessment 도메인

---

domain: assessment_case_participants
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

case_id
varchar(36) (FK → assessment_cases.id)
assessment_cases 연결
@db/not null

participant_id
varchar(36) (다형참조 → clients, members)
다형 대상 (participant_type로 판별)
@db/not null

participant_type
varchar(20)
...
@db/not null

assigned_at
datetime
...
@db/not null

unassigned_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assessment_cases
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

counselor_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

status
varchar(20)
...
@db/not null, default=pending

case_code
varchar(50)
...
@db/not null

completed_at
datetime
...
@db/nullable

is_final_report_required
boolean
...
@db/not null, default=False

documents
jsonb
...
@db/not null

tags
array
...
@db/not null

institution_summary
jsonb
...
@db/nullable

assessment_summary
jsonb
...
@db/not null

set_summary
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assessment_packages
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

name
varchar(255)
...
@db/not null

package_price
integer
...
@db/nullable

is_active
boolean
...
@db/not null, default=True

description
text
...
@db/nullable

assessment_summary
jsonb
...
@db/not null

center_member_summary
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assessment_send_links
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

case_id
varchar(36) (FK → assessment_cases.id)
assessment_cases 연결
@db/not null, index

assessment_ids
array
...
@db/not null

channel
varchar(20)
...
@db/not null, default=alarmtalk

verification_code
varchar(4)
...
@db/not null, index

failed_attempts
integer
...
@db/not null, default=0

expires_at
datetime
...
@db/nullable

revoked_at
datetime
...
@db/nullable

recipients
jsonb
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assessment_send_results
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

case_id
varchar(36) (FK → assessment_cases.id)
assessment_cases 연결
@db/not null, index

channel
varchar(20)
...
@db/not null, default=alarmtalk

verification_code
varchar(4)
...
@db/not null, index

failed_attempts
integer
...
@db/not null, default=0

expires_at
datetime
...
@db/nullable

revoked_at
datetime
...
@db/nullable

recipients
jsonb
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assessment_session_participants
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

session_id
varchar(36) (FK → assessment_sessions.id)
assessment_sessions 연결
@db/not null

participant_id
varchar(36) (다형참조 → clients, members)
다형 대상 (participant_type로 판별)
@db/not null

participant_type
varchar(20)
...
@db/not null

attendance_status
varchar(20)
...
@db/not null, default=scheduled

attended_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assessment_sessions
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

case_id
varchar(36) (FK → assessment_cases.id)
assessment_cases 연결
@db/not null

schedule_id
varchar(36) (FK → schedules.id)
schedules 연결
@db/nullable, index

status
varchar(20)
...
@db/not null, default=scheduled

cancel_reason
varchar(500)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assessment_sets
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

name
varchar(255)
...
@db/not null

description
text
...
@db/nullable

assessment_summary
jsonb
...
@db/not null

center_member_summary
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assessment_tasks
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

case_id
varchar(36) (FK → assessment_cases.id)
assessment_cases 연결
@db/not null

assessment_id
varchar(36) (FK → assessments.id)
assessments 연결
@db/not null

session_id
varchar(36) (FK → assessment_sessions.id)
assessment_sessions 연결
@db/nullable, index

report_document_id
varchar(36) (FK → documents.id)
documents 연결
@db/nullable, index

status
varchar(20)
...
@db/not null, default=pending

execution_method
varchar(20)
...
@db/not null, default=onsite

completed_at
datetime
...
@db/nullable

is_report_visible_to_guardian
boolean
...
@db/not null, default=False

process
jsonb
...
@db/not null

opinion
text
...
@db/nullable

report_payload
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assessments
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

code
varchar(50)
...
@db/not null

assessment_type
varchar(20)
...
@db/not null

status
varchar(20)
...
@db/not null, default=AssessmentStatus.PRIVATE

workflow_type
varchar(30)
...
@db/not null, default=WorkflowType.SELF_REPORT

kor_name
varchar(255)
...
@db/not null

eng_name
varchar(255)
...
@db/not null

age
varchar(100)
...
@db/nullable

external_url
varchar(500)
...
@db/nullable

version
varchar(20)
...
@db/not null, default=1.0

duration
integer
...
@db/nullable

supports_online
boolean
...
@db/not null, default=False

definition
jsonb
...
@db/not null

description
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: center_assessments
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

assessment_id
varchar(36) (FK → assessments.id)
assessments 연결
@db/not null

is_active
boolean
...
@db/not null, default=True

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Assistant 도메인

---

domain: assistant_conversations
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

member_id
varchar(36) (FK → members.id)
members 연결
@db/not null

title
varchar(200)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: assistant_turns
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

conversation_id
varchar(36) (FK → assistant_conversations.id)
assistant_conversations 연결
@db/not null

status
varchar(20)
...
@db/not null, default=AssistantTurnStatus.RUNNING

ended_at
datetime
...
@db/nullable

user_message
text
...
@db/not null

events
jsonb
...
@db/not null

completion
text
...
@db/nullable

bookmark
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Auth 도메인

---

domain: accounts
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

provider
varchar(20)
...
@db/not null, default=email

provider_id
varchar(255)
...
@db/nullable

email
varchar(255)
...
@db/not null

password
varchar(255)
...
@db/not null

lock_pin
varchar(255)
...
@db/nullable

lock_pin_duration_minute
integer
...
@db/nullable

token_version
integer
...
@db/not null, default=0

last_login_at
datetime
...
@db/nullable

is_active
boolean
...
@db/not null, default=True

is_verified
boolean
...
@db/not null, default=False

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: login_notifications
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

account_id
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null, index

device_info
varchar(500)
...
@db/nullable

ip_address
varchar(45)
...
@db/not null

location
varchar(255)
...
@db/nullable

login_at
datetime
...
@db/not null, index

notified_at
datetime
...
@db/nullable

is_new_device
boolean
...
@db/not null, default=False

error_message
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: password_histories
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

account_id
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

password
varchar(255)
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: refresh_tokens
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

account_id
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

parent_token_id
varchar(36) (FK → refresh_tokens.id)
refresh_tokens 연결
@db/nullable

token_hash
varchar(255)
...
@db/not null, unique

device_info
varchar(500)
...
@db/nullable

ip_address
varchar(45)
...
@db/nullable

expires_at
datetime
...
@db/not null

used_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Billing 도메인

---

domain: billable_items
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

billable_id
varchar(36) (FK → billables.id)
billables 연결
@db/not null

item_id
varchar(36)
...
@db/nullable

item_type
varchar(20)
...
@db/not null

related_case_id
varchar(36)
...
@db/nullable

related_session_id
varchar(36)
...
@db/nullable

client_voucher_id
varchar(36) (FK → client_vouchers.id)
client_vouchers 연결
@db/nullable

price_list_id
varchar(36) (FK → price_lists.id)
price_lists 연결
@db/nullable

related_type
varchar(50)
...
@db/nullable

quantity
integer
...
@db/not null, default=1

unit_price
integer
...
@db/not null, default=0

amount
integer
...
@db/not null, default=0

subsidy_amount
integer
...
@db/not null, default=0

provided_at
datetime
...
@db/nullable

description
varchar(200)
...
@db/not null

memo
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: billables
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

created_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

status
varchar(20)
...
@db/not null, default=issued

total_amount
integer
...
@db/not null, default=0

discount_amount
integer
...
@db/not null, default=0

subsidy_amount
integer
...
@db/not null, default=0

paid_amount
integer
...
@db/not null, default=0

unpaid_amount
integer
...
@db/not null, default=0

billable_date
date
...
@db/not null

issued_at
datetime
...
@db/nullable

due_date
date
...
@db/nullable

memo
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: payment_records
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

client_name
varchar(100)
...
@db/nullable

client_code
varchar(20)
...
@db/nullable

related_type
varchar(50)
...
@db/nullable

related_id
varchar(36)
...
@db/nullable

billing_code
varchar(20)
...
@db/not null

description
varchar(200)
...
@db/not null

amount
integer
...
@db/not null, default=0

status
varchar(20)
...
@db/not null, default=pending

issued_at
datetime
...
@db/not null

completed_at
datetime
...
@db/nullable

completed_by
varchar(36)
...
@db/nullable

completed_by_name
varchar(100)
...
@db/nullable

created_by
varchar(36)
...
@db/not null

note
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: payments
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

billable_id
varchar(36) (FK → billables.id)
billables 연결
@db/not null

created_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

payment_method
varchar(20)
...
@db/not null

receipt_number
varchar(50)
...
@db/nullable

amount
integer
...
@db/not null

paid_at
datetime
...
@db/not null

memo
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: price_lists
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

reference_id
varchar(36) (다형참조 → assessment_sets, assessments, programs)
다형 대상 (service_type로 판별)
@db/nullable

created_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

service_type
varchar(20)
...
@db/not null

source
varchar(20)
...
@db/not null, default=manual

service_name
varchar(100)
...
@db/not null

unit_price
integer
...
@db/not null, default=0

is_active
boolean
...
@db/not null, default=True

memo
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Center 도메인

---

domain: center_applications
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable

created_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

reviewed_by
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/nullable

status
varchar(20)
...
@db/not null, default=CenterApplicationStatus.PENDING

name
varchar(100)
...
@db/not null

representative_name
varchar(100)
...
@db/nullable

phone
varchar(20)
...
@db/nullable

address
jsonb
...
@db/nullable

business_registration_number
varchar(12)
...
@db/nullable

reviewed_at
datetime
...
@db/nullable

description
text
...
@db/nullable

reviewed_reason
varchar(500)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: center_note_preferences
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

default_template_type
varchar(30)
...
@db/not null, default=default

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: centers
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

code
varchar(6)
...
@db/not null

name
varchar(100)
...
@db/not null

representative_name
varchar(100)
...
@db/nullable

phone
varchar(20)
...
@db/nullable

address
jsonb
...
@db/nullable

logo_url
varchar(500)
...
@db/nullable

image_urls
jsonb
...
@db/nullable

business_registration_number
varchar(12)
...
@db/nullable

is_active
boolean
...
@db/not null, default=True

description
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: member_invitations
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

role_id
varchar(36) (FK → roles.id)
roles 연결
@db/not null

member_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

invited_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

employment_type
varchar(20)
...
@db/nullable

name
varchar(100)
...
@db/not null

email
varchar(255)
...
@db/not null, index

accepted_at
datetime
...
@db/nullable

expires_at
datetime
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: member_non_working_times
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

member_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

year
integer
...
@db/nullable

month
integer
...
@db/nullable

day
integer
...
@db/nullable

month_week
integer
...
@db/nullable

weekday
varchar(3)
...
@db/nullable

start_time
time
...
@db/nullable

end_time
time
...
@db/nullable

effective_from
datetime
...
@db/not null

effective_to
datetime
...
@db/nullable

reason
varchar(20)
...
@db/not null

description
varchar(200)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: member_working_times
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

member_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

weekday
varchar(3)
...
@db/not null

start_time
time
...
@db/nullable

end_time
time
...
@db/nullable

break_start_time
time
...
@db/nullable

break_end_time
time
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: members
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null, index

role_id
varchar(36) (FK → roles.id)
roles 연결
@db/not null

employment_type
varchar(20)
...
@db/nullable

hire_date
date
...
@db/nullable

profile_image_url
varchar(500)
...
@db/nullable

color
varchar(7)
...
@db/nullable

memo
text
...
@db/nullable

careers
jsonb
...
@db/nullable

educations
jsonb
...
@db/nullable

certifications
jsonb
...
@db/nullable

status
varchar(20)
...
@db/not null, default=active

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: non_operating_times
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

created_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/nullable

year
integer
...
@db/nullable

month
integer
...
@db/nullable

day
integer
...
@db/nullable

month_week
integer
...
@db/nullable

weekday
varchar(3)
...
@db/nullable

start_time
time
...
@db/nullable

end_time
time
...
@db/nullable

effective_from
datetime
...
@db/not null

effective_to
datetime
...
@db/nullable

is_system_registered
boolean
...
@db/not null, default=False

reason
varchar(200)
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: operating_times
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

weekday
varchar(3)
...
@db/not null

open_time
time
...
@db/nullable

close_time
time
...
@db/nullable

break_start_time
time
...
@db/nullable

break_end_time
time
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: program_members
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

program_id
varchar(36) (FK → programs.id)
programs 연결
@db/not null, index

member_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: programs
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

program_type
varchar(20)
...
@db/not null, default=INDIVIDUAL

name
varchar(100)
...
@db/not null

price
integer
...
@db/not null, default=0

duration_minutes
integer
...
@db/not null, default=50

is_active
boolean
...
@db/not null, default=True

description
varchar(1000)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: rooms
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

name
varchar(100)
...
@db/not null

thumbnail_url
varchar(500)
...
@db/nullable

is_active
boolean
...
@db/not null, default=True

description
varchar(500)
...
@db/nullable

memo
text
...
@db/nullable

inactive_reason
varchar(200)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## CenterLink 도메인

---

domain: center_link_audits
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

link_id
varchar(36) (FK → center_links.id)
center_links 연결
@db/nullable, index

invitation_id
varchar(36) (FK → center_link_invitations.id)
center_link_invitations 연결
@db/nullable

actor_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

actor_type
varchar(20)
...
@db/not null

action
varchar(50)
...
@db/not null

snapshot
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: center_link_invitations
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

guardian_client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null, index

issued_by_member_id
varchar(36) (FK → members.id)
members 연결
@db/not null

claimed_by_person_id
varchar(36) (FK → persons.id)
persons 연결
@db/nullable

code
varchar(6)
...
@db/not null, index

expires_at
datetime
...
@db/not null

revoked_at
datetime
...
@db/nullable

claimed_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: center_links
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

family_id
varchar(36) (FK → families.id)
families 연결
@db/not null, index

profile_id
varchar(36) (FK → profiles.id)
profiles 연결
@db/not null, index

person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null, index

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null, index

guardian_client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

invitation_id
varchar(36) (FK → center_link_invitations.id)
center_link_invitations 연결
@db/nullable

status
varchar(20)
...
@db/not null, default=active

end_reason
varchar(50)
...
@db/nullable

linked_at
datetime
...
@db/nullable

ended_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Client 도메인

---

domain: client_favorites
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: client_link_requests
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/nullable

status
varchar(20)
...
@db/not null, default=LinkRequestStatus.PENDING

phone
varchar(20)
...
@db/not null

requested_at
datetime
...
@db/not null

reviewed_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: client_relations
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

related_client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

relation_type
varchar(20)
...
@db/not null

relation_detail
varchar(50)
...
@db/nullable

is_primary
boolean
...
@db/not null, default=False

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: client_resources
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

resource_id
varchar(36) (다형참조 → documents, forms)
다형 대상 (resource_type로 판별)
@db/not null

resource_type
varchar(20)
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: client_unlink_logs
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null

unlinked_at
datetime
...
@db/not null

reason
varchar(500)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: clients
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

person_id
varchar(36) (FK → persons.id)
persons 연결
@db/nullable

code
varchar(6)
...
@db/not null

role
varchar(20)
...
@db/not null

status
varchar(20)
...
@db/not null, default=active

name
varchar(100)
...
@db/not null

birth_date
date
...
@db/nullable

gender
varchar(10)
...
@db/nullable

phone
varchar(20)
...
@db/nullable

email
varchar(100)
...
@db/nullable

address
varchar(500)
...
@db/nullable

profile_image_url
varchar(500)
...
@db/nullable

memo
varchar(2000)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: sibling_relations
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

sibling_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

relation_detail
varchar(50)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Counseling 도메인

---

domain: counseling_case_analyses
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

counseling_case_id
varchar(36) (FK → counseling_cases.id)
counseling_cases 연결
@db/not null, index

triggered_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

status
varchar(20)
상태: processing/completed/failed
@db/not null, default=processing

error_message
varchar(500)
...
@db/nullable

model_used
varchar(80)
...
@db/nullable

input_tokens
integer
...
@db/not null, default=0

output_tokens
integer
...
@db/not null, default=0

session_count
integer
...
@db/not null, default=0

content
jsonb
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: counseling_case_participants
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

counseling_case_id
varchar(36) (FK → counseling_cases.id)
counseling_cases 연결
@db/not null, index

participant_id
varchar(36) (다형참조 → clients, members)
다형 대상 (participant_type로 판별)
@db/not null, index

participant_type
varchar(20)
...
@db/not null

joined_at
datetime
...
@db/not null

left_at
datetime
...
@db/nullable

is_active
boolean
...
@db/not null, default=True

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: counseling_cases
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

program_id
varchar(36) (FK → programs.id)
programs 연결
@db/not null, index

counselor_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

status
varchar(20)
...
@db/not null, index, default=CounselingCaseStatus.ACTIVE

case_code
varchar(6)
...
@db/not null, index

total_sessions
integer
...
@db/nullable

chief_complaint
varchar(1000)
...
@db/nullable

session_rule
jsonb
...
@db/nullable

memo
varchar(2000)
...
@db/nullable

participant_snapshot
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: counseling_note_ai_drafts
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

counseling_session_id
varchar(36) (FK → counseling_sessions.id)
counseling_sessions 연결
@db/not null, index

field_note_id
varchar(36) (FK → field_notes.id)
field_notes 연결
@db/not null, index

llm_call_id
varchar(36) (FK → llm_calls.id)
llm_calls 연결
@db/nullable, index

author_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

template_type
varchar(50)
...
@db/not null

content
jsonb
...
@db/not null

summary
varchar(1000)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: counseling_note_derivations
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

counseling_note_id
varchar(36) (FK → counseling_notes.id)
counseling_notes 연결
@db/not null, index

counseling_session_id
varchar(36) (FK → counseling_sessions.id)
counseling_sessions 연결
@db/not null, index

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null, index

llm_call_id
varchar(36) (FK → llm_calls.id)
llm_calls 연결
@db/nullable, index

author_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

published_by
varchar(36) (FK → members.id)
members 연결
@db/nullable

status
varchar(20)
...
@db/not null, default=draft

kind
varchar(20)
...
@db/not null

published_at
datetime
...
@db/nullable

generated_content
jsonb
...
@db/not null

content
jsonb
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: counseling_notes
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

counseling_session_id
varchar(36) (FK → counseling_sessions.id)
counseling_sessions 연결
@db/not null, index

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null, index

author_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

content
jsonb
...
@db/not null

summary
varchar(1000)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: counseling_session_participants
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

session_id
varchar(36) (FK → counseling_sessions.id)
counseling_sessions 연결
@db/not null

participant_id
varchar(36) (다형참조 → clients, members)
다형 대상 (participant_type로 판별)
@db/not null

participant_type
varchar(20)
...
@db/not null

attendance_status
varchar(20)
...
@db/not null, default=scheduled

attended_at
datetime
...
@db/nullable

is_consumed
boolean
...
@db/not null, index, default=False

memo
varchar(500)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: counseling_sessions
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

counseling_case_id
varchar(36) (FK → counseling_cases.id)
counseling_cases 연결
@db/not null, index

schedule_id
varchar(36) (FK → schedules.id)
schedules 연결
@db/not null, index

status
varchar(20)
...
@db/not null, index, default=CounselingSessionStatus.SCHEDULED

session_number
integer
...
@db/nullable

completed_at
datetime
...
@db/nullable

cancel_reason
varchar(500)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## DirectoryCenter 도메인

---

domain: directory_centers
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

source_id
integer
...
@db/not null

category
varchar(20)
...
@db/not null

name
varchar(255)
...
@db/not null

address
text
...
@db/not null

latitude
float
...
@db/not null

longitude
float
...
@db/not null

website_url
text
...
@db/nullable

phone_number
varchar(30)
...
@db/nullable

operating_hours_text
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Document 도메인

---

domain: document_accesses
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

document_id
varchar(36) (FK → documents.id)
documents 연결
@db/not null, index

s3_version_id
varchar(100)
...
@db/nullable

account_id
varchar(36) (FK → accounts.id)
accounts 연결
@db/nullable, index

action
varchar(20)
...
@db/not null

ip_address
varchar(45)
...
@db/nullable

user_agent
text
...
@db/nullable

accessed_at
datetime
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: documents
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

uploader_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

file_type
varchar(100)
...
@db/not null

access_level
varchar(20)
...
@db/not null, default=center

name
varchar(255)
...
@db/not null

original_name
varchar(255)
...
@db/nullable

storage_path
varchar(512)
...
@db/not null, unique

checksum
varchar(64)
...
@db/not null

file_size
bigint
...
@db/not null

description
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: global_documents
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

uploader_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

file_type
varchar(100)
...
@db/not null

name
varchar(255)
...
@db/not null

original_name
varchar(255)
...
@db/nullable

storage_path
varchar(512)
...
@db/not null, unique

checksum
varchar(64)
...
@db/nullable

file_size
bigint
...
@db/not null

description
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: share_tokens
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

document_id
varchar(36) (FK → documents.id)
documents 연결
@db/not null, index

created_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

token
varchar(64)
...
@db/not null, unique, index

password_hash
varchar(255)
...
@db/nullable

max_downloads
integer
...
@db/nullable

download_count
integer
...
@db/not null, default=0

expires_at
datetime
...
@db/not null, index

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Event 도메인

---

domain: event_atomics
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

event_id
varchar(36) (FK → events.id)
events 연결
@db/not null, index

entity_id
varchar(36)
...
@db/not null, index

entity_name
varchar(50)
...
@db/not null

actor_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

act
varchar(30)
...
@db/not null

sequence
integer
...
@db/not null

payload
jsonb
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: event_reactions
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

event_id
varchar(36) (FK → events.id)
events 연결
@db/not null, index

reaction
varchar(100)
...
@db/not null

ok
boolean
...
@db/not null

error
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: events
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable, index

actor_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

actor_type
varchar(20)
...
@db/not null, index, default=member

status
varchar(20)
...
@db/not null, index, default=pending

name
varchar(100)
...
@db/not null

ip_address
varchar(45)
...
@db/nullable

max_attempts
integer
...
@db/not null, default=5

claimed_at
datetime
...
@db/nullable

succeeded_at
datetime
...
@db/nullable

failed_at
datetime
...
@db/nullable

next_attempt_at
datetime
...
@db/nullable, index

attempts
jsonb
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Family 도메인

---

domain: families
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

name
varchar(100)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: family_invitations
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

family_id
varchar(36) (FK → families.id)
families 연결
@db/not null, index

invited_by_person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null

claimed_by_person_id
varchar(36) (FK → persons.id)
persons 연결
@db/nullable

code
varchar(6)
...
@db/not null, index

expires_at
datetime
...
@db/not null

revoked_at
datetime
...
@db/nullable

claimed_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: family_members
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

family_id
varchar(36) (FK → families.id)
families 연결
@db/not null, index

person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null, index

role
varchar(20)
...
@db/not null, default=owner

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: profiles
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

family_id
varchar(36) (FK → families.id)
families 연결
@db/not null, index

display_name
varchar(100)
...
@db/not null

relation
varchar(20)
...
@db/not null, default=child

birth_date
date
...
@db/nullable

gender
varchar(10)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## FieldNote 도메인

---

domain: field_note_audios
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

field_note_id
varchar(36) (FK → field_notes.id)
field_notes 연결
@db/not null, index

transcript_status
varchar(20)
...
@db/not null, default=FieldNoteAudioTranscriptStatus.PENDING

storage_path
varchar(500)
...
@db/not null

stt_model_used
varchar(50)
...
@db/nullable

chunk_index
integer
...
@db/not null

duration
float
...
@db/not null, default=0.0

transcript
text
...
@db/nullable

diarized_transcript
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: field_note_entries
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

field_note_id
varchar(36) (FK → field_notes.id)
field_notes 연결
@db/not null, index

entry_type
varchar(20)
...
@db/not null

tag_category
varchar(30)
...
@db/nullable

timestamp_seconds
float
...
@db/not null, default=0.0

content
text
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: field_notes
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

schedule_id
varchar(36) (FK → schedules.id)
schedules 연결
@db/nullable, index

task_id
varchar(36) (FK → assessment_tasks.id)
assessment_tasks 연결
@db/nullable, index

author_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

status
varchar(20)
...
@db/not null, default=FieldNoteStatus.RECORDING

processing_status
varchar(20)
...
@db/not null, default=FieldNoteProcessingStatus.IDLE

transcribe_status
varchar(20)
...
@db/not null, default=FieldNoteTranscribeStatus.PENDING

refine_status
varchar(20)
...
@db/not null, default=FieldNoteRefineStatus.NONE

diarization_status
varchar(20)
...
@db/not null, default=FieldNoteDiarizationStatus.NONE

note_status
varchar(20)
...
@db/not null, default=FieldNoteNoteStatus.NONE

note_template_type
varchar(30)
...
@db/nullable

summary_status
varchar(20)
...
@db/not null, default=FieldNoteSummaryStatus.NONE

processing_step
varchar(30)
...
@db/nullable

failed_step
varchar(30)
...
@db/nullable

refinement_model
varchar(50)
...
@db/nullable

summary_model
varchar(50)
...
@db/nullable

note_number
integer
...
@db/nullable

total_duration
float
...
@db/not null, default=0.0

summary_generated_at
datetime
...
@db/nullable

refined_transcript
text
...
@db/nullable

summary
text
...
@db/nullable

speaker_map
text
...
@db/nullable

nonverbal_markers
text
...
@db/nullable

analysis
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Form 도메인

---

domain: form_extractions
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable

source_document_id
varchar(36) (FK → documents.id)
documents 연결
@db/not null

image_document_id
varchar(36) (FK → documents.id)
documents 연결
@db/nullable

status
varchar(20)
...
@db/not null, default=FormExtractionStatus.PROCESSING

name
varchar(100)
...
@db/not null

page_range
int4range
...
@db/nullable

started_at
datetime
...
@db/not null, server_default

completed_at
datetime
...
@db/nullable

failed_at
datetime
...
@db/nullable

completed
jsonb
...
@db/nullable

failed
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: form_sends
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

form_template_id
varchar(36) (FK → form_templates.id)
form_templates 연결
@db/not null, index

recipients
jsonb
...
@db/not null

channel
varchar(20)
...
@db/not null, default=sms

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: form_signatures
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

instance_id
varchar(36) (FK → forms.id)
forms 연결
@db/not null

field_id
varchar(100)
...
@db/not null

storage_type
varchar(20)
...
@db/not null, default=base64

signer_name
varchar(100)
...
@db/not null

storage_path
varchar(500)
...
@db/nullable

signer_ip
varchar(45)
...
@db/nullable

signed_at
datetime
...
@db/not null

signature_data
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: form_templates
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable

status
varchar(20)
...
@db/not null, default=FormTemplateStatus.DRAFT

name
varchar(100)
...
@db/not null

version
integer
...
@db/not null, default=1

is_active
boolean
...
@db/not null, default=True

schema
jsonb
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: form_values
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

instance_id
varchar(36) (FK → forms.id)
forms 연결
@db/not null

field_key
varchar(100)
...
@db/not null

group_index
integer
...
@db/not null, default=0

value
jsonb
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: forms
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

template_id
varchar(36) (FK → form_templates.id)
form_templates 연결
@db/not null

created_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/nullable

submitted_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/nullable

status
varchar(20)
...
@db/not null, default=FormStatus.DRAFT

submitted_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Institution 도메인

---

domain: institutions
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

name
varchar(100)
...
@db/not null

phone
varchar(20)
...
@db/nullable

address
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Ledger 도메인

---

domain: ledger_entries
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

profile_id
varchar(36) (FK → profiles.id)
profiles 연결
@db/not null, index

author_person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null, index

entry_type
varchar(20)
...
@db/not null, default=observation

mood
varchar(20)
...
@db/nullable

situation_tags
jsonb
...
@db/not null

client_key
varchar(64)
...
@db/not null

occurred_at
datetime
...
@db/not null

bookmarked_at
datetime
...
@db/nullable

body
text
...
@db/nullable

private_memo
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: ledger_media
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

entry_id
varchar(36) (FK → ledger_entries.id)
ledger_entries 연결
@db/not null, index

media_type
varchar(10)
...
@db/not null

upload_status
varchar(20)
...
@db/not null, default=pending

storage_path
varchar(500)
...
@db/not null

checksum
varchar(128)
...
@db/nullable

duration_ms
integer
...
@db/nullable

width
integer
...
@db/nullable

height
integer
...
@db/nullable

poster_path
varchar(500)
...
@db/nullable

quota_month
varchar(7)
...
@db/not null

sort_order
integer
...
@db/not null, default=0

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Llm 도메인

---

domain: credit_balances
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

plan_type
varchar(20)
...
@db/not null, server_default

credit_limit
integer
...
@db/not null, server_default

credit_used
integer
...
@db/not null, default=0

period_start
datetime
...
@db/not null

period_end
datetime
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: credit_rate_configs
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

changed_by
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/nullable

tokens_per_credit
integer
...
@db/not null

effective_from
datetime
...
@db/not null

effective_to
datetime
...
@db/nullable

reason
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: llm_calls
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable, index

session_id
varchar(36)
...
@db/nullable, index

member_id
varchar(36) (FK → members.id)
members 연결
@db/nullable, index

trace_id
varchar(36)
...
@db/nullable, index

source_id
varchar(36)
...
@db/nullable, index

source_type
varchar(20)
...
@db/not null, index, default=agent

model
varchar(100)
...
@db/nullable

purpose
varchar(50)
...
@db/not null, index

input_tokens
integer
...
@db/not null, default=0

output_tokens
integer
...
@db/not null, default=0

tokens_per_credit
integer
...
@db/nullable

credits_charged
integer
...
@db/nullable

latency_ms
float
...
@db/nullable

audio_duration_seconds
float
...
@db/nullable

error_message
text
...
@db/nullable

meta
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Messaging 도메인

---

domain: message_logs
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

send_link_id
varchar(36) (FK → assessment_send_links.id)
assessment_send_links 연결
@db/nullable, index

send_result_id
varchar(36) (FK → assessment_send_results.id)
assessment_send_results 연결
@db/nullable, index

form_send_id
varchar(36) (FK → form_sends.id)
form_sends 연결
@db/nullable, index

message_type
varchar(20)
...
@db/not null, index

status
varchar(20)
...
@db/not null, index, default=MessageStatus.PENDING

template_code
varchar(50)
...
@db/nullable, index

lgu_message_id
varchar(100)
...
@db/nullable, unique, index

recipient
varchar(20)
...
@db/not null, index

attempts
integer
...
@db/not null, default=0

sent_at
datetime
...
@db/nullable

scheduled_at
datetime
...
@db/nullable, index

failed_at
datetime
...
@db/nullable

message
text
...
@db/not null

error_message
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: message_templates
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable, index

template_type
varchar(50)
...
@db/not null

name
varchar(100)
...
@db/not null

is_default
boolean
...
@db/not null, default=False

variables
jsonb
...
@db/not null

content
text
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Notice 도메인

---

domain: notice_reads
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

notice_id
varchar(36) (FK → notices.id)
notices 연결
@db/not null

member_id
varchar(36) (FK → members.id)
members 연결
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: notices
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

created_by
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/not null

category
varchar(30)
...
@db/not null

title
varchar(200)
...
@db/not null

published_at
datetime
...
@db/nullable

is_published
boolean
...
@db/not null, default=False

is_pinned
boolean
...
@db/not null, default=False

content
text
...
@db/not null

attachments
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Notification 도메인

---

domain: notification_logs
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

notification_id
varchar(36) (FK → notifications.id)
notifications 연결
@db/nullable

recipient_id
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

status
varchar(20)
...
@db/not null, default=pending

channel
varchar(20)
...
@db/not null

sent_at
datetime
...
@db/nullable

error_message
text
...
@db/nullable

request_payload
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: notification_settings
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable

account_id
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

event_type
varchar(50)
...
@db/nullable

category
varchar(30)
...
@db/not null

channel_in_app
boolean
...
@db/not null, default=True

channel_push
boolean
...
@db/not null, default=False

channel_alarmtalk
boolean
...
@db/not null, default=False

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: notifications
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

recipient_id
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

event_type
varchar(50)
...
@db/not null

category
varchar(30)
...
@db/not null

priority
varchar(20)
...
@db/not null, default=normal

title
varchar(200)
...
@db/not null

event_ref
varchar(200)
...
@db/nullable

read_at
datetime
...
@db/nullable

is_read
boolean
...
@db/not null, default=False

body
text
...
@db/not null

data
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: push_tokens
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable

account_id
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

token
varchar(512)
...
@db/not null, unique

device_info
varchar(256)
...
@db/nullable

platform
varchar(10)
...
@db/not null, default=web

is_active
boolean
...
@db/not null, default=True

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Person 도메인

---

domain: person_credentials
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null, index

reviewed_by
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/nullable

credential_type
varchar(20)
...
@db/not null, index

status
varchar(20)
...
@db/not null, index, default=CredentialStatus.UNVERIFIED

title
varchar(200)
...
@db/not null

organization
varchar(200)
...
@db/not null

attachment_url
varchar(500)
...
@db/nullable

attachment_content_type
varchar(100)
...
@db/nullable

attachment_filename
varchar(255)
...
@db/nullable

attachment_size
integer
...
@db/nullable

start_date
date
...
@db/nullable

end_date
date
...
@db/nullable

requested_at
datetime
...
@db/nullable

reviewed_at
datetime
...
@db/nullable

is_current
boolean
...
@db/not null, default=False

description
text
...
@db/nullable

metadata
jsonb
...
@db/nullable

reject_reason
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: persons
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

account_id
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

name
varchar(100)
...
@db/not null

phone
varchar(20)
...
@db/not null

birth
date
...
@db/nullable

gender
varchar(10)
...
@db/nullable

is_certified
boolean
...
@db/not null, default=False

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## PersonProfile 도메인

---

domain: person_profiles
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

member_id
varchar(36) (FK → members.id)
members 연결
@db/not null, index

version
integer
...
@db/not null, default=0

analyzed_at
datetime
...
@db/nullable

content
jsonb
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## PlatformAdmin 도메인

---

domain: admin_account_invitations
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

invited_by
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/not null

role
varchar(30)
...
@db/not null

name
varchar(100)
...
@db/not null

email
varchar(255)
...
@db/not null

token
varchar(512)
...
@db/not null

expires_at
datetime
...
@db/not null

accepted_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: admin_accounts
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

role
varchar(30)
...
@db/not null

name
varchar(100)
...
@db/not null

email
varchar(255)
...
@db/not null

password
varchar(255)
...
@db/not null

token_version
integer
...
@db/not null, default=0

failed_login_count
integer
...
@db/not null, default=0

locked_until
datetime
...
@db/nullable

last_login_at
datetime
...
@db/nullable

is_active
boolean
...
@db/not null, default=True

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: admin_audit_logs
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

admin_account_id
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/not null

admin_email
varchar(200)
...
@db/not null

action
varchar(100)
...
@db/not null

target_type
varchar(50)
...
@db/not null

target_id
varchar(36)
...
@db/not null

summary
text
...
@db/not null

ip_address
varchar(45)
...
@db/nullable

extra
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: admin_refresh_tokens
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

admin_account_id
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/not null

parent_token_id
varchar(36) (FK → admin_refresh_tokens.id)
admin_refresh_tokens 연결
@db/nullable

token_hash
varchar(255)
...
@db/not null, unique

device_info
varchar(500)
...
@db/nullable

ip_address
varchar(45)
...
@db/nullable

expires_at
datetime
...
@db/not null

used_at
datetime
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: cs_memos
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable

created_by
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/not null

memo_type
varchar(30)
...
@db/not null

title
varchar(200)
...
@db/not null

center_name
varchar(200)
...
@db/nullable

content
text
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: faqs
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

created_by
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/not null

category
varchar(50)
카테고리: getting_started/general/technical/feature
@db/not null

question
varchar(500)
...
@db/not null

sort_order
integer
...
@db/not null, default=0

is_published
boolean
...
@db/not null, default=False

answer
text
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: inquiries
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable

answered_by
varchar(36) (FK → admin_accounts.id)
admin_accounts 연결
@db/nullable

inquiry_type
varchar(30)
유형: general/technical/feature_request/other
@db/not null

status
varchar(20)
상태: pending/in_progress/resolved/closed
@db/not null, default=pending

center_name
varchar(200)
센터명 비정규화
@db/nullable

sender_name
varchar(100)
...
@db/not null

subject
varchar(300)
...
@db/not null

sender_email
varchar(200)
...
@db/not null

answered_at
datetime
...
@db/nullable

answer
text
...
@db/nullable

content
text
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: plan_configs
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

plan_type
varchar(30)
...
@db/not null, unique

base_plan
varchar(30)
...
@db/nullable

label
varchar(50)
...
@db/not null

badge_text
varchar(50)
...
@db/nullable

tagline
varchar(200)
...
@db/nullable

audience
varchar(200)
...
@db/nullable

badge_bg
varchar(50)
...
@db/nullable

price_monthly
integer
...
@db/not null, default=0

credit_limit
integer
...
@db/not null, default=0

plan_order
integer
...
@db/not null, default=0

is_active
boolean
...
@db/not null, default=True

is_recommended
boolean
...
@db/not null, default=False

features
text
...
@db/not null, default=[]

base_features
text
...
@db/nullable

additions
text
...
@db/nullable

feature_labels
text
...
@db/nullable

feature_descriptions
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: platform_settings
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

key
varchar(100)
...
@db/not null, unique

value
text
...
@db/not null

description
varchar(500)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Role 도메인

---

domain: permissions
scope: global

id
integer
...
@db/PK, not null

code
varchar(100)
...
@db/not null, index

category
varchar(50)
...
@db/not null, index

name
varchar(100)
...
@db/not null

added_at
datetime
...
@db/not null

is_new
boolean
...
@db/not null, default=False

description
varchar(500)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: role_permissions
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

role_id
varchar(36) (FK → roles.id)
roles 연결
@db/PK, not null

permission_id
integer (FK → permissions.id)
permissions 연결
@db/PK, not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: roles
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/nullable, index

code
varchar(50)
...
@db/not null, index

access_level
varchar(20)
...
@db/not null, default=own

name
varchar(100)
...
@db/not null

version
integer
...
@db/not null, default=1

description
varchar(500)
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Schedule 도메인

---

domain: schedule_change_requests
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

schedule_id
varchar(36) (FK → schedules.id)
schedules 연결
@db/not null, index

person_id
varchar(36) (FK → persons.id)
persons 연결
@db/not null, index

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null, index

decided_by_member_id
varchar(36) (FK → members.id)
members 연결
@db/nullable

status
varchar(20)
...
@db/not null, index, default=pending

current_start
datetime
...
@db/not null

current_end
datetime
...
@db/not null

requested_start
datetime
...
@db/not null

requested_end
datetime
...
@db/not null

decided_at
datetime
...
@db/nullable

reason
text
...
@db/nullable

decision_note
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: schedules
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null, index

member_id
varchar(36) (FK → members.id)
members 연결
@db/nullable, index

room_id
varchar(36) (FK → rooms.id)
rooms 연결
@db/nullable, index

schedule_type
varchar(20)
...
@db/not null, index

title
varchar(200)
...
@db/nullable

start
datetime
...
@db/not null, index

end
datetime
...
@db/not null, index

memo
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Subscription 도메인

---

domain: subscription_history
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

subscription_id
varchar(36) (FK → subscriptions.id)
subscriptions 연결
@db/not null

actor_type
varchar(20)
...
@db/not null

from_status
varchar(20)
...
@db/nullable

to_status
varchar(20)
...
@db/nullable

from_plan
varchar(20)
...
@db/nullable

to_plan
varchar(20)
...
@db/not null

changed_at
datetime
...
@db/not null

reason
varchar(100)
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: subscription_payments
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

subscription_id
varchar(36) (FK → subscriptions.id)
subscriptions 연결
@db/not null

status
varchar(20)
...
@db/not null, default=pending

plan
varchar(20)
...
@db/not null

toss_order_id
varchar(64)
...
@db/not null

toss_payment_key
varchar(200)
...
@db/nullable

method
varchar(30)
...
@db/nullable

amount
integer
...
@db/not null

paid_at
datetime
...
@db/nullable

raw_response
text
...
@db/nullable

failed_reason
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: subscriptions
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

status
varchar(20)
...
@db/not null, default=active

plan
varchar(20)
...
@db/not null, default=free

reserved_plan
varchar(20)
...
@db/nullable

current_period_start
datetime
...
@db/not null

current_period_end
datetime
...
@db/not null

trial_end
datetime
...
@db/nullable

quota_grace_end
datetime
...
@db/nullable

cancelled_at
datetime
...
@db/nullable

reserved_at
datetime
...
@db/nullable

is_quota_exceeded
boolean
...
@db/not null, default=False

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Voucher 도메인

---

domain: center_vouchers
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

catalog_id
varchar(36) (FK → vouchers.id)
vouchers 연결
@db/not null

created_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

default_total_sessions
integer
...
@db/nullable

unit_price
integer
...
@db/nullable

is_active
boolean
...
@db/not null, default=True

memo
text
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: client_voucher_resources
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

client_voucher_id
varchar(36) (FK → client_vouchers.id)
client_vouchers 연결
@db/not null

resource_id
varchar(36) (다형참조 → documents, forms)
다형 대상 (resource_type로 판별)
@db/not null

resource_type
varchar(20)
...
@db/not null

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: client_vouchers
scope: center

id
varchar(36)
UUID Primary Key
@db/PK, not null

center_id
varchar(36) (FK → centers.id)
centers 연결
@db/not null

client_id
varchar(36) (FK → clients.id)
clients 연결
@db/not null

center_voucher_id
varchar(36) (FK → center_vouchers.id)
center_vouchers 연결
@db/not null

created_by
varchar(36) (FK → accounts.id)
accounts 연결
@db/not null

total_sessions
integer
...
@db/not null

remaining_sessions
integer
...
@db/not null

total_amount
integer
...
@db/nullable

remaining_amount
integer
...
@db/nullable

valid_from
date
...
@db/nullable

valid_until
date
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: voucher_documents
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

voucher_id
varchar(36) (FK → vouchers.id)
vouchers 연결
@db/not null

global_document_id
varchar(36) (FK → global_documents.id)
global_documents 연결
@db/not null

page_range
int4range
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: voucher_extractions
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

source_document_ids
jsonb
...
@db/not null, server_default

artifact_document_ids
jsonb
...
@db/not null, server_default

status
varchar(20)
...
@db/not null, default=VoucherExtractionStatus.PROCESSING

started_at
datetime
...
@db/not null, server_default

completed_at
datetime
...
@db/nullable

failed_at
datetime
...
@db/nullable

completed
jsonb
...
@db/nullable

failed
text
...
@db/nullable

progress
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

---

domain: vouchers
scope: global

id
varchar(36)
UUID Primary Key
@db/PK, not null

name
varchar(255)
...
@db/not null

program_name
varchar(255)
...
@db/not null

program_organization
varchar(255)
...
@db/not null

program_year
integer
...
@db/not null

usage_start_date
date
...
@db/nullable

usage_end_date
date
...
@db/nullable

application_start_date
date
...
@db/nullable

application_end_date
date
...
@db/nullable

application_method
text
...
@db/nullable

support_scope
text
...
@db/nullable

support_target
text
...
@db/nullable

contact
text
...
@db/nullable

eligibility
jsonb
...
@db/nullable

record
jsonb
...
@db/nullable

support_amount
jsonb
...
@db/nullable

created_at
datetime
생성 시각 (UTC)
@db/not null, server_default

updated_at
datetime
수정 시각 (UTC)
@db/not null, server_default

deleted_at
datetime
삭제 시각 (UTC, Soft Delete)
@db/nullable

## Scope 범례

| scope | 설명 |
|-------|------|
| global | 센터 경계 없이 전역 관리 (center_id 없음) |
| center | 센터별 격리 (center_id 필수, RLS 적용) |
