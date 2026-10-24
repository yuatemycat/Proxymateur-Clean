import sys
import json
import os
import datetime

log_file = r"C:\Users\X\.gemini\config\queue\hook_debug.log"

def log(msg):
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now().isoformat()}] {msg}\n")
    except Exception:
        pass

try:
    raw_input = sys.stdin.read()
    log(f"HOOK CALLED with raw_input: {raw_input[:200]}")
    payload = json.loads(raw_input) if raw_input.strip() else {}
except Exception as e:
    log(f"Error parsing stdin: {e}")
    payload = {}

# If fullyIdle is explicitly false, do not dequeue yet
if payload.get("fullyIdle") is False:
    log("fullyIdle is False, returning decision: stop")
    print(json.dumps({"decision": "stop"}))
    sys.exit(0)

queue_file = r"C:\Users\X\.gemini\config\queue\pending.json"
if not os.path.exists(queue_file):
    log("Queue file does not exist, returning decision: stop")
    print(json.dumps({"decision": "stop"}))
    sys.exit(0)

try:
    with open(queue_file, "r", encoding="utf-8") as f:
        tasks = json.load(f)
except Exception as e:
    log(f"Error loading queue file: {e}")
    tasks = []

if not tasks or not isinstance(tasks, list):
    log("No tasks in queue, returning decision: stop")
    print(json.dumps({"decision": "stop"}))
    sys.exit(0)

next_task = tasks[0]
remaining = tasks[1:]

try:
    with open(queue_file, "w", encoding="utf-8") as f:
        json.dump(remaining, f, indent=2, ensure_ascii=False)
except Exception as e:
    log(f"Error saving remaining queue: {e}")

task_text = next_task.get("task", "")
queued_at = next_task.get("queued_at", "")
remaining_count = len(remaining)

label = f" ({remaining_count} more task(s) remaining in queue)" if remaining_count > 0 else ""
reason_msg = f"[Queue] Executing deferred task{label}:\n\n{task_text}"

response = {
    "decision": "continue",
    "reason": reason_msg
}
log(f"DEQUEUED task: {task_text[:50]}, returning decision: continue")
print(json.dumps(response))
