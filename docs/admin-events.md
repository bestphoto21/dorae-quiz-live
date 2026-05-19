# 관리자 행사 관리

이 문서는 Dorae Quiz Live의 5단계 행사 관리 화면에서 구현한 범위와 다음 단계에서 이어갈 작업을 정리한다.

## 행사 생성 흐름

관리자는 `/admin/events/new`에서 행사 기본 정보를 입력한다.

1. 서버 액션이 `requireAdmin()`으로 활성 관리자 여부를 확인한다.
2. `event_code`를 trim 후 lowercase로 정규화한다.
3. 필수값, 행사 코드 형식, 시간 범위, 대표 색상 형식을 검증한다.
4. `events`에 행사 row를 생성한다.
5. 같은 `event_id`로 `live_state` row를 1개 생성한다.
6. 생성한 관리자를 `event_admins`에 `event_admin` 역할로 연결한다.
7. `operation_logs`에 `event_created`를 기록한다.
8. 성공하면 `/admin/events/[eventId]`로 이동한다.

## event_code 규칙

`event_code`는 참가자 URL `/e/[eventCode]`와 송출 URL `/screen/[eventCode]`에 사용된다.

- 소문자 영문, 숫자, 하이픈만 허용한다.
- 입력값은 서버에서 trim 후 lowercase 처리한다.
- 같은 행사 코드는 중복으로 만들 수 없다.
- 예: `dorae-2026`, `main-stage`, `team-a-quiz`

## live_state row 자동 생성 이유

행사를 만들 때 `live_state`를 함께 생성하면 스크린 송출 화면과 운영 화면이 항상 하나의 기준 상태를 읽을 수 있다.

초기값은 다음 원칙을 따른다.

- `mode = waiting`
- `reveal_answer = false`
- `show_results = false`
- `screen_payload = {}`

아직 실시간 기능은 구현하지 않았지만, 이후 라이브 진행과 스크린 제어 기능은 이 row를 중심으로 확장한다.

## event_admins 권한 구조

`admin_profiles`는 관리자 계정의 전역 역할을 나타내고, `event_admins`는 특정 행사 접근 권한을 나타낸다.

- `super_admin`: 모든 행사에 접근 가능하다.
- `event_admin`: 배정된 행사를 관리할 수 있다.
- `operator`: 배정된 행사 운영 화면에 접근할 수 있다.
- `screen_operator`: 배정된 행사 스크린 운영에 사용할 역할이다.
- `qna_moderator`: 배정된 행사 Q&A 관리에 사용할 역할이다.

이번 단계에서는 세부 기능별 권한 분기는 최소화하고, 배정된 행사에 접근 가능한지만 공통 helper에서 확인한다.

## super_admin과 행사별 관리자

`super_admin`은 `event_admins` row가 없어도 전체 행사 목록과 상세 화면에 접근할 수 있다.

행사를 생성할 때는 `super_admin`도 `event_admins`에 연결한다. 이 연결은 필수 권한 조건이 아니라 감사 추적과 향후 행사별 워크플로우를 편하게 만들기 위한 보조 데이터다.

`event_admin`, `operator`, `screen_operator`, `qna_moderator`는 `event_admins`에 배정된 행사만 볼 수 있다.

## event_code를 수정하지 않는 이유

행사 코드는 현장 QR, 참가자 안내 링크, 스크린 송출 URL에 직접 들어간다. 운영 중 코드를 바꾸면 이미 배포한 QR과 안내 링크가 끊길 수 있으므로, 설정 화면에서는 행사 코드를 읽기 전용으로 표시한다.

정말 변경이 필요한 경우에는 추후 별도의 리다이렉트 테이블이나 코드 변경 로그를 설계한 뒤 처리해야 한다.

## 아직 구현하지 않은 것

- 참가자 등록 저장
- 행사 비활성 시 참가자 입장 차단
- 퀴즈 세션 및 문제 CRUD
- 실시간 라이브 진행
- 스크린 송출 데이터 조회
- Q&A 등록, 승인, 송출
- 경품 및 추첨 로직
- 관리자 초대 및 행사별 권한 배정 UI
- 세부 기능별 역할 분기

## 다음 단계

다음 단계에서는 참가자 입장과 등록 흐름을 연결하거나, 관리자 화면에서 퀴즈 세션과 문제 CRUD를 먼저 구현할 수 있다. 어느 쪽을 먼저 하더라도 server action 내부에서 권한을 다시 확인하고, 참가자 공개 조회와 관리자 전용 조회를 분리해야 한다.
