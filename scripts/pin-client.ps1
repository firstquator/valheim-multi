# 게임과 Discord 를 서버가 쓰지 않는 코어로 보낸다.
#
# 왜 필요한가.
# 이 PC 는 6코어 12스레드인데 서버와 게임을 같이 돌린다. 재어 보니 게임이
# 코어 2.7 개, 서버가 3.1 개를 쓰면서 물리 코어를 거의 다 채우고 있었다.
# 여러 명이 한곳에 모이면 양쪽이 동시에 치솟아 서버 틱이 흔들렸고,
# 접속한 전원이 끊김과 타격 판정 이상을 겪었다.
#
# 처음에는 6-11 로 묶었는데 그러면 클라이언트가 3 물리코어에 갇혀
# 몹이 나올 때 프레임이 밀렸다. 서버가 실제로 쓰는 양(코어 0.24 개)을
# 재어 보고 4-11 로 넓혔다.
#
# 서버는 docker-compose.yml 의 cpuset 으로 0-3 에 묶어 두었다. 이 스크립트는
# 반대편을 맡는다. 게임을 껐다 켜면 설정이 풀리므로 다시 불러야 한다.
#
# 쓰는 법
#   한 번만    powershell -ExecutionPolicy Bypass -File scripts\pin-client.ps1
#   계속 감시  같은 명령에 -Watch 를 붙인다
#   예약       scripts\install-pin-task.ps1 이 5분마다 돌도록 등록한다

param(
    [switch]$Watch,
    [int]$IntervalSeconds = 300
)

# 논리코어 4-11 = 비트 4..11 = 4080 (0xFF0)
$TARGET = [IntPtr]4080
$NAMES = @('valheim', 'Discord')

function Set-Affinity {
    $moved = 0
    $already = 0
    foreach ($name in $NAMES) {
        foreach ($p in Get-Process -Name $name -ErrorAction SilentlyContinue) {
            try {
                if ($p.ProcessorAffinity -eq $TARGET) {
                    $already++
                    continue
                }
                $p.ProcessorAffinity = $TARGET
                $moved++
            }
            catch {
                # 권한이 없거나 그 사이 종료된 프로세스다. 조용히 넘어간다.
                # 하나 실패했다고 나머지까지 멈출 이유가 없다.
            }
        }
    }
    return @{ Moved = $moved; Already = $already }
}

if ($Watch) {
    Write-Host "감시를 시작합니다. $IntervalSeconds 초마다 확인합니다. (Ctrl+C 로 중지)"
    while ($true) {
        $r = Set-Affinity
        if ($r.Moved -gt 0) {
            Write-Host ("{0}  {1}개를 코어 6-11 로 옮겼습니다" -f (Get-Date -Format 'HH:mm:ss'), $r.Moved)
        }
        Start-Sleep -Seconds $IntervalSeconds
    }
}
else {
    $r = Set-Affinity
    if ($r.Moved -eq 0 -and $r.Already -eq 0) {
        Write-Host "게임도 Discord 도 실행 중이 아닙니다. 할 일이 없습니다."
    }
    else {
        Write-Host ("옮김 {0}개, 이미 맞음 {1}개" -f $r.Moved, $r.Already)
    }
}
