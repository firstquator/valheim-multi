#!/usr/bin/env bash
# 유휴 판정 로직. 부수효과가 없는 순수 함수다.
# 실제 종료 행동은 idle-guard.sh 가 담당한다.

# 기동 직후 유예 시간. 없으면 켜자마자 꺼진다.
: "${GRACE_PERIOD_SEC:=900}"

# 접속자 0명이 이 시간을 넘게 지속되면 종료한다.
: "${IDLE_LIMIT_SEC:=1200}"

# idle_decide <uptime_sec> <player_count> <idle_elapsed_sec>
#   grace    : 기동 유예 중. 아무것도 하지 않는다
#   reset    : 접속자가 있다. 유휴 카운터를 초기화한다
#   wait     : 접속자는 없지만 아직 한계에 도달하지 않았다
#   shutdown : 종료 조건 충족
idle_decide() {
  local uptime="$1"
  local players="$2"
  local idle_elapsed="$3"

  # 유예 판정이 가장 우선한다. 켜자마자 꺼지는 것을 막는 것이 최우선이다.
  if [ "$uptime" -le "$GRACE_PERIOD_SEC" ]; then
    printf 'grace'
    return 0
  fi

  if [ "$players" -gt 0 ]; then
    printf 'reset'
    return 0
  fi

  if [ "$idle_elapsed" -gt "$IDLE_LIMIT_SEC" ]; then
    printf 'shutdown'
    return 0
  fi

  printf 'wait'
}
