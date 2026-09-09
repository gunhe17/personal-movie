#!/bin/sh
# Baseline clips for the bundled-files button. ~220MB total, so they are generated, not committed.
set -e
cd "$(dirname "$0")"
mk() { ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=$2:rate=$3:duration=${5:-20}" \
  -vf "noise=alls=12:allf=t+u" -c:v libx264 -preset fast -b:v "$4" -g "$6" -keyint_min "$6" \
  -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart "$1"; echo "  $1"; }
mk 1080p30_gop60.mp4  1920x1080 30 15M 20 60
mk 1080p60_gop120.mp4 1920x1080 60 20M 20 120
mk 4k30_gop60.mp4     3840x2160 30 50M 20 60
mk short_25fps_4s.mp4 1280x720  25  6M  4 50
