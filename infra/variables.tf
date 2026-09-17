variable "project_id" {
  description = "GCP 프로젝트 ID"
  type        = string
}

variable "region" {
  description = "리전. 참여자 전원 한국 거주이므로 서울"
  type        = string
  default     = "asia-northeast3"
}

variable "zone" {
  description = "존. Task 2에서 n2-standard-4 가용성을 확인한 존"
  type        = string
  default     = "asia-northeast3-a"
}

variable "bucket_name" {
  description = "백업과 배포 파일을 담는 GCS 버킷 이름. 전역 고유해야 한다"
  type        = string
}

variable "game_port" {
  description = "발헤임 게임 포트. 서버는 이 포트와 다음 포트(쿼리)를 사용한다"
  type        = number
  default     = 2456
}
