#!/usr/bin/env bash
# For the CI's installs (.github/workflows/test.yml): runs a command, stops it if it takes longer than a limit, and
# tries again, up to a number of tries. Now and then a download on GitHub's machines stalls (once for 38 minutes,
# which ran a WebKit part out of time); a stalled try is stopped and the next one usually goes through.
#
#   bash e2e/ci-try.sh <tries> <seconds> <command...>
#
# Each failed or stopped try is put on the run's page as a warning. An apt install stopped part way is finished off
# before the next try (sudo -n: never asks for a password, so it does nothing off GitHub's machines).
# (v319) A pause before each next try, longer each time (CI_TRY_PAUSE seconds × the try just failed; 30 unless set): a
# package server that's slow for a minute or two has time to recover instead of failing every try in a row.
tries=$1
secs=$2
shift 2
for i in $(seq 1 "$tries"); do
  if timeout --kill-after=20 "$secs" "$@"; then exit 0; fi
  echo "::warning::$* failed or took over ${secs}s (try $i of $tries)"
  sudo -n dpkg --configure -a >/dev/null 2>&1 || true
  if [ "$i" -lt "$tries" ]; then sleep $(( ${CI_TRY_PAUSE:-30} * i )); fi
done
exit 1
