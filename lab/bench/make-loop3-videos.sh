#!/bin/sh
# Loop-3 stimulus: a 5-minute source, built by repeating a loop-2 clip without re-encoding.
set -e
cd "$(dirname "$0")"
[ -f nobf_1080p30.mp4 ] || { echo "run ./make-loop2-videos.sh first"; exit 1; }
ffmpeg -y -loglevel error -stream_loop 14 -i nobf_1080p30.mp4 -c copy \
  -movflags +faststart long5min_nobf.mp4
echo "  long5min_nobf.mp4  (9000 frames / 300s / ~360MB)"
