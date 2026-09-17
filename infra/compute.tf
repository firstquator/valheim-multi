# 고정 IP. 친구들이 Steam 즐겨찾기에 등록할 수 있도록 한다.
# VM이 정지한 동안에도 요금이 발생하지만 90일 기준 소액이다.
resource "google_compute_address" "server" {
  name   = "valheim-ip"
  region = var.region
}

resource "google_compute_instance" "server" {
  name         = "valheim-server"
  machine_type = "n2-standard-4"
  zone         = var.zone
  tags         = ["valheim-server"]

  # 머신 타입 변경 시 Terraform이 VM을 중지할 수 있도록 허용한다.
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 50
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.main.id

    access_config {
      nat_ip = google_compute_address.server.address
    }
  }

  service_account {
    email  = google_service_account.vm.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    "bucket-name"     = google_storage_bucket.data.name
    "startup-script"  = file("${path.module}/startup.sh")
    "enable-oslogin"  = "TRUE"
  }

  # idle-guard가 게스트 내부에서 shutdown을 실행하면 VM은 TERMINATED가 되고
  # 컴퓨트 과금이 멈춘다. 자동 재시작이 켜져 있어도 게스트가 스스로 내린
  # 종료는 되살아나지 않는다. 호스트 장애 시에만 재시작된다.
  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  # metadata["startup-script"] 변경을 무시한다.
  # 이 설정은 전원 상태(power state)나 인스턴스 재생성 여부와는 무관하다.
  # metadata 변경은 원래 in-place로 반영되며 VM 재생성을 유발하지 않는다.
  # 실제 효과는 하나뿐이다: startup.sh 파일을 고쳐도 Terraform이 기존
  # VM의 startup-script 메타데이터를 갱신하지 않아 변경이 반영되지
  # 않는다는 것이다. 스크립트를 수정했다면
  # `apply -replace=google_compute_instance.server` 로 명시적으로
  # 인스턴스를 교체해야 새 스크립트가 적용된다.
  lifecycle {
    ignore_changes = [metadata["startup-script"]]
  }
}
