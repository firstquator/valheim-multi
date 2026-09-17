#!/usr/bin/env bats

@test "테스트 컨테이너에 bash가 있다" {
  run bash --version
  [ "$status" -eq 0 ]
}

@test "테스트 컨테이너에 jq가 있다" {
  run jq --version
  [ "$status" -eq 0 ]
}

@test "저장소 루트가 /code로 마운트된다" {
  [ -f /code/README.md ]
}
