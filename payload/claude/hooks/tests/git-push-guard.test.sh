#!/bin/bash
# Cases for git-push-guard.sh. Usage: bash tests/git-push-guard.test.sh [hook-path]
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_lib.sh"
HOOK="${1:-$DIR/../git-push-guard.sh}"
bash_() { jq -cn --arg c "$1" '{tool_name:"Bash",cwd:"/tmp",tool_input:{command:$c}}'; }
c() { check "$1" "$2" "$(bash_ "$2")"; }
# feature pushes pass
c empty 'git push origin feat/x'
c empty 'git push -u origin feat/x'
c empty 'git push origin HEAD:feature'
c empty 'git push origin maintenance'
c empty 'git push origin release-notes-fix'
c empty 'git push origin v2-feature'
c empty 'rm -f build.log && git push origin feat/x'
c empty 'git -C /tmp/repo push origin feat/x'
# not a push: ignored
c empty 'git status'
c empty 'git log main'
c empty 'echo "git push --force"x'
# asked: force, delete, tags, protected targets
c ask 'git push --force origin feat'
c ask 'git push -f origin feat'
c ask 'git push -fu origin feat'
c ask 'git push --force-with-lease origin feat'
c ask 'git push origin +feat'
c ask 'git push --mirror backup'
c ask 'git push origin HEAD:main'
c ask 'git push origin main'
c ask 'git push -u origin master'
c ask 'git push origin HEAD:refs/heads/production'
c ask 'git push --tags'
c ask 'git push --follow-tags origin feat'
c ask 'git push origin v1.2.0'
c ask 'git push origin refs/tags/v1'
c ask 'git push origin --delete old'
c ask 'git push origin -d old'
c ask 'git push origin :old'
c ask 'git add . && git commit -m x && git push origin main'
c ask 'git -C /tmp/repo push --force origin feat'
OUT=$(bash_ 'git push origin :old' | "$HOOK"); has delete-reason "$OUT" "branch delete"
OUT=$(bash_ 'git push origin HEAD:main' | "$HOOK"); has protected-reason "$OUT" "protected branch"
check empty not-json 'not json'
finish
