#!/usr/bin/env bats

setup() {
  load '/code/agent/lib/decide.sh'
}

@test "기동 후 15분 이내면 grace를 반환한다" {
  run idle_decide 60 0 0
  [ "$output" = "grace" ]
}

@test "기동 후 정확히 900초는 아직 grace다 (경계값)" {
  run idle_decide 900 0 0
  [ "$output" = "grace" ]
}

@test "기동 후 901초부터 판정이 시작된다" {
  run idle_decide 901 0 0
  [ "$output" != "grace" ]
}

@test "접속자가 있으면 reset을 반환한다" {
  run idle_decide 3600 3 0
  [ "$output" = "reset" ]
}

@test "유예를 넘겨도 접속자가 있으면 reset이다" {
  run idle_decide 99999 1 999999
  [ "$output" = "reset" ]
}

@test "접속자 0명이고 유휴 시간이 짧으면 wait이다" {
  run idle_decide 3600 0 60
  [ "$output" = "wait" ]
}

@test "접속자 0명이고 유휴가 정확히 1200초면 아직 wait이다 (경계값)" {
  run idle_decide 3600 0 1200
  [ "$output" = "wait" ]
}

@test "접속자 0명이고 유휴가 1201초면 shutdown이다" {
  run idle_decide 3600 0 1201
  [ "$output" = "shutdown" ]
}

@test "유예 판정이 유휴 판정보다 우선한다" {
  run idle_decide 100 0 99999
  [ "$output" = "grace" ]
}
