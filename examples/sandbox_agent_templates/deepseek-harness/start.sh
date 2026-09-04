#!/usr/bin/env bash
set -euo pipefail

export HOME="${HOME:-/home/user}"
export DSH_HOME="${DSH_HOME:-${HOME}/.dsh}"

mkdir -p "${DSH_HOME}" /tmp/deepseek-harness

stop_owned_process() {
  local pid_file="$1"
  local expected="$2"
  [[ -f "${pid_file}" ]] || return 0
  local pid
  pid="$(< "${pid_file}")"
  if [[ "${pid}" =~ ^[0-9]+$ ]] && [[ -r "/proc/${pid}/cmdline" ]] \
    && tr '\0' ' ' < "/proc/${pid}/cmdline" | grep -Fq "${expected}"; then
    kill "${pid}" 2>/dev/null || true
    for _ in {1..50}; do
      [[ -e "/proc/${pid}" ]] || break
      sleep 0.1
    done
    if [[ -e "/proc/${pid}" ]]; then
      kill -KILL "${pid}" 2>/dev/null || true
    fi
  fi
  rm -f "${pid_file}"
}

# A resumed or rebuilt VM can contain stale processes. Stop only processes
# owned by this template, then launch fresh instances for this Sandbox.
stop_owned_process /tmp/deepseek-harness/supervisor.pid 'supervisor.mjs'
stop_owned_process /tmp/deepseek-harness/dsh.pid 'dsh web'
stop_owned_process /tmp/deepseek-harness/gateway.pid 'web-gateway.mjs'

nohup node /opt/deepseek-harness/supervisor.mjs \
  >>/tmp/deepseek-harness/supervisor.log 2>&1 &
echo $! > /tmp/deepseek-harness/supervisor.pid

echo "DeepSeek Harness supervisor started"
