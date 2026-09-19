# pin-client.ps1 을 5분마다 돌도록 작업 스케줄러에 등록한다.
#
# 게임을 껐다 켜면 코어 배정이 풀린다. 사람이 매번 기억해서 다시 돌릴 수는
# 없으니 예약해 둔다. 하는 일이 프로세스 목록을 훑는 것뿐이라 5분마다 돌아도
# 부담이 없다.
#
# -AtStartup 을 쓰지 않는다. 그쪽은 관리자 권한을 요구해서 예전에 "액세스가
# 거부되었습니다" 로 실패한 적이 있다. 로그온 트리거는 권한 없이 등록된다.
#
# 쓰는 법
#   powershell -ExecutionPolicy Bypass -File scripts\install-pin-task.ps1
#   해제하려면  Unregister-ScheduledTask -TaskName "Valheim-PinClient" -Confirm:$false

$ErrorActionPreference = "Stop"

$taskName = "Valheim-PinClient"
$script = Join-Path $PSScriptRoot "pin-client.ps1"

if (-not (Test-Path $script)) {
    throw "pin-client.ps1 을 찾지 못했습니다: $script"
}

# 이미 있으면 지우고 다시 만든다. 설정을 고쳤을 때 갱신되어야 한다.
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "기존 작업을 지우고 다시 등록합니다"
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""

# 1분 뒤부터 5분마다. 기한은 두지 않는다.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -MultipleInstances IgnoreNew

# 주체를 반드시 적는다. 생략하면 시스템 계정으로 등록하려 들어
# "Access is denied" 로 막힌다. 여기 있는 다른 작업들도 전부
# 로그인한 사용자(Interactive, Limited)로 등록되어 있다.
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "발헤임 게임과 Discord 를 서버가 쓰지 않는 코어(6-11)로 보낸다. 게임을 껐다 켜면 풀리므로 주기적으로 다시 맞춘다." | Out-Null

Write-Host "등록 완료: $taskName"
Get-ScheduledTask -TaskName $taskName |
    Select-Object TaskName, State |
    Format-Table -AutoSize
