# 월드 백업과 에이전트 배포 파일을 담는다.
# 월드의 정본은 VM 디스크가 아니라 이 버킷이다.
# 체험판 만료 시 VM은 사라지지만 버킷의 데이터는 회수할 수 있다.
resource "google_storage_bucket" "data" {
  name     = var.bucket_name
  location = var.region

  uniform_bucket_level_access = true

  # 덮어써져서 non-current(ARCHIVED) 상태가 된 이전 버전만 7일간 보존한 뒤 삭제한다.
  # 살아 있는(LIVE) 백업 객체는 이 규칙으로 지우지 않는다. gcloud storage rsync가
  # 매번 새 타임스탬프 파일명으로 올리므로 실제로는 덮어쓰기 자체가 거의 없고,
  # 대부분의 백업은 이 규칙과 무관하게 계속 쌓인다. 이는 의도된 동작이다: 90일
  # 누적분도 스토리지 비용이 미미하므로(서울 리전 Standard 기준 대략 몇 달러
  # 수준), 실수로 필요한 백업을 지우는 위험을 피하기 위해 LIVE 객체를 삭제하는
  # 규칙은 두지 않는다.
  #
  # age는 객체 "생성 시각" 기준이라 non-current 보존 조건으로 쓰면 안 된다.
  # non-current가 된 시점부터 며칠을 셀 때는 days_since_noncurrent_time을 써야
  # 한다.
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 7
      with_state                 = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }
}
