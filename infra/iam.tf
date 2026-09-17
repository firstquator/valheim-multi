# VM이 사용할 서비스 계정.
# 권한은 백업 버킷 읽기/쓰기로만 제한한다.
# VM 자신을 중지할 권한은 필요 없다. idle-guard는 게스트 내부에서
# shutdown 명령을 쓰므로 Compute API 권한이 불필요하다.
resource "google_service_account" "vm" {
  account_id   = "valheim-vm"
  display_name = "Valheim 게임 서버 VM"
}

resource "google_storage_bucket_iam_member" "vm_bucket" {
  bucket = google_storage_bucket.data.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.vm.email}"
}
