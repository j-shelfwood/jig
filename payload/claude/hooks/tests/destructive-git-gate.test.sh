#!/bin/bash
# Cases for destructive-git-gate.sh. Usage: bash tests/destructive-git-gate.test.sh [hook-path]
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_lib.sh"
HOOK="${1:-$DIR/../destructive-git-gate.sh}"
c() { check "$1" "$2" "$(jq -cn --arg c "$2" '{tool_name:"Bash",cwd:"/tmp",tool_input:{command:$c}}')"; }
c ask 'git reset --hard'
c ask 'git reset --hard origin/main'
c ask 'git reset -q --hard HEAD~1'
c ask 'git clean -fd'
c ask 'git clean -n'
c ask 'git -C /tmp/repo reset --hard'
c ask 'cd /tmp/repo && git clean -fdx'
c ask 'git fetch && git reset --hard @{u}'
c empty 'git reset HEAD file.txt'
c empty 'git reset --soft HEAD~1'
c empty 'git status'
c empty 'make clean'
c empty 'git commit -m "clean up the reset --hard docs"'
c empty 'rg -n "git clean" docs'
OUT=$(jq -cn '{tool_input:{command:"git clean -fd"}}' | "$HOOK"); has reason "$OUT" "git clean discards uncommitted work"
check empty not-json 'not json'
finish
