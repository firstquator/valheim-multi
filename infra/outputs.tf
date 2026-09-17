output "bucket_name" {
  description = "백업과 배포 파일 버킷"
  value       = google_storage_bucket.data.name
}

output "service_account_email" {
  description = "VM 서비스 계정"
  value       = google_service_account.vm.email
}
