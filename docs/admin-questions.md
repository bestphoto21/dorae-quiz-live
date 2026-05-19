# 관리자 퀴즈 세션 및 문제 관리

이 문서는 Dorae Quiz Live의 6단계에서 추가한 관리자용 퀴즈 세션과 문제 관리 구조를 정리한다.

## 퀴즈 세션 개념

`quiz_sessions`는 하나의 행사 안에서 여러 라운드나 운영 단위를 나누기 위한 테이블이다.

- 하나의 `events` row는 여러 `quiz_sessions`를 가질 수 있다.
- 세션 상태는 `draft`, `ready`, `live`, `ended` 중 하나다.
- 문제는 세션에 속하며, 세션을 선택한 뒤 문제 목록을 관리한다.
- 운영 실수를 줄이기 위해 문제가 연결된 세션 삭제는 서버 액션에서 막는다. DB는 `on delete cascade` 구조지만, 관리자 UI에서는 먼저 문제를 정리하도록 유도한다.

## 문제 등록 구조

`questions`는 현재 4지선다형 구조를 기본으로 한다.

- `question_text`: 질문 본문
- `option_1` ~ `option_4`: 선택지
- `correct_option`: 정답 번호
- `time_limit_seconds`: 응답 제한 시간, 5초 이상 300초 이하
- `order_index`: 세션 안에서의 문제 순서
- `question_type`: 문제 유형
- `is_active`: 운영 화면에서 사용할 활성 여부

이번 단계에서는 관리자 화면에서 생성, 조회, 수정, 삭제, 위/아래 이동을 제공한다. 참가자 응답 저장이나 실시간 송출은 아직 연결하지 않았다.

## question_type

`question_type`은 002 migration에서 확장 대비용으로 추가한 필드다.

- `quiz_single`: 단일 정답 퀴즈, MVP 기본값
- `poll_single`: 단일 선택 투표
- `poll_multiple`: 복수 선택 투표
- `ox`: OX 유형

현재 DB 구조는 `option_1`부터 `option_4`까지 모두 필수이므로, `ox`도 관리자 저장 단계에서는 4개 선택지를 유지한다. 다음 단계에서 참가자용 문제 payload를 만들 때 `ox`는 `option_1`과 `option_2`만 노출하는 방식으로 분리할 수 있다.

## correct_option 보안 주의사항

`correct_option`은 정답 키이므로 관리자 화면에서만 보여야 한다.

- 참가자 화면은 `questions` 테이블을 직접 조회하면 안 된다.
- 정답 공개 전에는 `correct_option`이 public response나 realtime payload에 포함되면 안 된다.
- 참가자용 문제 조회는 추후 screen-safe/public-safe RPC, server route, 또는 server action으로 분리해야 한다.
- 이번 단계에서는 참가자 공개 API를 만들지 않았다.

## order_index 관리

문제 생성 시 선택된 세션의 마지막 순서 뒤에 새 문제를 붙인다.

위/아래 이동 server action은 현재 세션의 문제 목록을 읽고, 선택한 문제와 인접 문제의 위치를 바꾼 뒤 `order_index`를 1부터 다시 저장한다. 문제 삭제 후에도 남은 문제의 `order_index`를 다시 정렬한다.

## 권한 기준

행사 접근은 기존 `requireEventAccess(eventId)`를 사용한다.

문제 생성, 수정, 삭제, 정렬은 다음 역할만 허용한다.

- `super_admin`
- 행사별 `event_admin`
- 행사별 `operator`

`screen_operator`와 `qna_moderator`는 행사와 문제를 조회할 수 있지만 문제 은행을 수정할 수 없다. 이 제한은 UI 표시뿐 아니라 server action 내부에서도 다시 검사한다.

## operation_logs

다음 작업은 `operation_logs`에 기록한다.

- `quiz_session_created`
- `quiz_session_updated`
- `quiz_session_deleted`
- `question_created`
- `question_updated`
- `question_deleted`
- `question_reordered`

로그 detail에는 `session_id`, `question_id`, `title`, `question_text`, `status`, `direction`처럼 운영에 필요한 정보만 넣고, 비밀번호나 개인정보는 넣지 않는다.

## 아직 구현하지 않은 것

- 참가자 등록
- 참가자용 문제 조회 API
- 참가자 응답 저장
- 실시간 문제 송출
- 스크린 화면의 실시간 표시
- 정답 공개 타이밍 제어
- 랭킹과 결과 집계
- 럭키드로우

## 다음 단계

다음 단계에서는 `live_state.current_session_id`, `live_state.current_question_id`, `mode`, `question_started_at`, `question_ends_at`을 문제 관리 데이터와 연결해야 한다. 관리자 라이브 진행 화면에서 세션과 문제를 선택하고, 참가자와 스크린이 볼 수 있는 안전한 payload를 별도로 만들어야 한다.
