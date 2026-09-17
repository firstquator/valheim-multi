# 월드 백업과 에이전트 배포 파일을 담는다.
# 월드의 정본은 VM 디스크가 아니라 이 버킷이다.
# 체험판 만료 시 VM은 사라지지만 버킷의 데이터는 회수할 수 있다.
resource "google_storage_bucket" "data" {
  name     = var.bucket_name
  location = var.region

  uniform_bucket_level_access = true

  # 실수로 삭제했을 때 되돌릴 수 있도록 7일간 보존한다.
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age                = 7
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }
}
