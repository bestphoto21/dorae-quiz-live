# 라이브 진행 콘솔과 스크린 송출

이 문서는 Dorae Quiz Live의 7단계에서 구현한 관리자 라이브 콘솔과 스크린 송출 화면 구조를 정리한다.

## live_state 역할

`live_state`는 행사별 현재 송출 상태를 담는 단일 row다.

- 현재 세션: `current_session_id`
- 현재 문제: `current_question_id`
- 진행 모드: `mode`
- 문제 시작/종료 시간: `question_started_at`, `question_ends_at`
- 정답 공개 여부: `reveal_answer`
- 결과 표시 여부: `show_results`
- 송출 장면 키: `screen_scene`
- 장면별 보조 데이터: `screen_payload`

관리자 라이브 콘솔은 이 row를 업데이트하고, 스크린 화면은 안전한 API를 통해 이 row를 읽는다.

## mode 값

- `waiting`: 대기 화면
- `question`: 문제 진행 중
- `closed`: 응답 마감
- `result`: 결과 또는 정답 공개
- `draw`: 추첨 장면, 아직 더미
- `qna`: Q&A 장면, 아직 더미

## screen_scene 역할

`mode`가 운영 상태의 큰 흐름이라면 `screen_scene`은 실제 송출 화면에서 어떤 장면을 렌더링할지 정하는 키다.

현재는 다음 값을 사용한다.

- `waiting`
- `question`
- `closed`
- `result`
- `inactive`

추후 당첨자 발표, 공지, Q&A 선택 질문 표시처럼 더 세밀한 장면을 추가할 수 있다.

## 관리자 버튼 흐름

대기 화면 전환:

- `mode = waiting`
- `current_question_id = null`
- `reveal_answer = false`
- `show_results = false`
- `screen_scene = waiting`

문제 시작:

- `mode = question`
- `current_session_id` 설정
- `current_question_id` 설정
- `question_started_at = now()`
- `question_ends_at = now() + time_limit_seconds`
- `reveal_answer = false`
- `show_results = false`
- `screen_scene = question`

응답 마감:

- `mode = closed`
- `reveal_answer = false`
- `show_results = false`
- `screen_scene = closed`

정답 공개:

- `mode = result`
- `reveal_answer = true`
- `show_results = true`
- `screen_scene = result`

결과 화면만 표시:

- `mode = result`
- `reveal_answer = false`
- `show_results = true`
- `screen_scene = result`

## correct_option 비노출 원칙

`correct_option`은 정답 키이므로 정답 공개 전에는 public 또는 screen payload에 포함하면 안 된다.

현재 `/api/screen/[eventCode]/state` route는 서버에서 현재 문제를 조합한 뒤 `live_state.reveal_answer = true`일 때만 `correct_option`을 응답에 포함한다.

스크린 React 화면도 `correct_option`이 없으면 정답 강조를 하지 않는다.

## screen-safe API 구조

스크린 화면은 `questions` 테이블을 직접 조회하지 않는다. 대신 다음 API만 호출한다.

`GET /api/screen/[eventCode]/state`

응답에는 다음 범위만 포함한다.

- 행사 송출 정보
- 현재 `live_state`
- 현재 문제의 질문과 선택지
- 정답 공개 후에만 `correct_option`
- 현재는 0으로 채운 응답 통계 placeholder

개인정보와 관리자 전용 필드는 포함하지 않는다.

## Polling 방식

`/screen/[eventCode]`는 MVP 단계에서 2초 간격 polling으로 상태를 갱신한다. 카운트다운은 브라우저에서 `question_ends_at` 기준으로 1초마다 계산한다.

추후에는 Supabase Realtime, Broadcast, 또는 edge-safe 상태 캐시로 개선할 수 있다.

## 아직 구현하지 않은 것

- 참가자 등록
- 참가자 응답 저장
- 자동 마감
- 실시간 응답 통계
- 정답자 표시
- 럭키드로우
- Q&A 송출
- Supabase Realtime/Broadcast

## 다음 단계

다음 단계에서는 참가자 등록과 응답 저장을 구현한 뒤, `answers` 기반으로 선택지별 카운트와 정답자 집계를 screen-safe API에 추가하는 흐름이 자연스럽다.
