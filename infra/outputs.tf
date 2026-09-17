output "bucket_name" {
  description = "백업과 배포 파일 버킷"
  value       = google_storage_bucket.data.name
}

output "service_account_email" {
  description = "VM 서비스 계정"
  value       = google_service_account.vm.email
}

output "server_ip" {
  description = "친구들이 접속할 고정 IP"
  value       = google_compute_address.server.address
}

output "instance_name" {
  description = "VM 인스턴스 이름"
  value       = google_compute_instance.server.name
}

output "instance_zone" {
  description = "VM 인스턴스 존"
  value       = google_compute_instance.server.zone
}
