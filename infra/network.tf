resource "google_compute_network" "main" {
  name                    = "valheim-net"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name          = "valheim-subnet"
  ip_cidr_range = "10.10.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id
}

# 게임 포트만 인터넷에 개방한다.
# 발헤임은 game_port(접속)와 game_port+1(Steam 쿼리)을 사용한다.
resource "google_compute_firewall" "game" {
  name    = "valheim-allow-game"
  network = google_compute_network.main.name

  allow {
    protocol = "udp"
    ports    = ["${var.game_port}-${var.game_port + 1}"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["valheim-server"]
}

# SSH는 인터넷에 열지 않는다. IAP 터널 대역에서만 허용한다.
resource "google_compute_firewall" "iap_ssh" {
  name    = "valheim-allow-iap-ssh"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["valheim-server"]
}
