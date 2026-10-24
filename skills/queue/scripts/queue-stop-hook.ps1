# queue-stop-hook.ps1
# Stop hook: reads pending.json and returns decision: continue with reason: <task>
# Runs when the agent execution loop terminates.

param()

$log_file = "C:\Users\X\.gemini\config\queue\hook_debug.log"
function Write-HookLog($msg) {
    try {
        $timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        "[$timestamp] $msg" | Out-File -FilePath $log_file -Append -Encoding UTF8
    } catch {}
}

$input_json = $null
try {
    $raw = [Console]::In.ReadToEnd()
    Write-HookLog "PS HOOK CALLED: $raw"
    if ($raw -and $raw.Trim()) {
        $input_json = $raw | ConvertFrom-Json
    }
} catch {
    Write-HookLog "Error parsing stdin: $_"
}

# If fullyIdle is explicitly false, do not dequeue yet
if ($input_json -and ($input_json.fullyIdle -eq $false)) {
    Write-HookLog "fullyIdle is False, returning decision: stop"
    Write-Output '{"decision":"stop"}'
    exit 0
}

$queue_file = "C:\Users\X\.gemini\config\queue\pending.json"

if (-not (Test-Path $queue_file)) {
    Write-HookLog "Queue file does not exist, returning decision: stop"
    Write-Output '{"decision":"stop"}'
    exit 0
}

$queue = @()
try {
    $content = Get-Content $queue_file -Raw -ErrorAction Stop
    if ($content.Trim() -ne '') {
        $queue = $content | ConvertFrom-Json
        if ($queue -isnot [System.Array]) {
            $queue = @($queue)
        }
    }
} catch {
    Write-HookLog "Error loading queue file: $_"
}

if ($queue.Count -eq 0) {
    Write-HookLog "No tasks in queue, returning decision: stop"
    Write-Output '{"decision":"stop"}'
    exit 0
}

# Dequeue the first task (FIFO)
$next_task = $queue[0]
$remaining = @($queue | Select-Object -Skip 1)

try {
    if ($remaining.Count -eq 0) {
        Set-Content $queue_file -Value '[]' -Encoding UTF8
    } else {
        $remaining | ConvertTo-Json -Depth 5 | Set-Content $queue_file -Encoding UTF8
    }
} catch {
    Write-HookLog "Error saving remaining queue: $_"
}

$task_text = $next_task.task
$queued_at = $next_task.queued_at
$remaining_count = $remaining.Count

$label = ""
if ($remaining_count -gt 0) {
    $label = " ($remaining_count more task(s) remaining in queue)"
}

$reason_msg = "[Queue] Executing deferred task${label}:`n`n${task_text}"

$output = @{
    decision = "continue"
    reason = $reason_msg
} | ConvertTo-Json -Depth 5 -Compress

Write-HookLog "DEQUEUED task: $task_text, returning decision: continue"
Write-Output $output
