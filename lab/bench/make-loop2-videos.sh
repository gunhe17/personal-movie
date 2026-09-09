#!/bin/sh
# Loop-2 stimuli, all derived from the loop-1 clips. Run make-test-videos.sh first.
set -e
cd "$(dirname "$0")"
[ -f 4k30_gop60.mp4 ] || { echo "run ./make-test-videos.sh first"; exit 1; }

# I3: 1080p preview proxy from the 4K source
ffmpeg -y -loglevel error -i 4k30_gop60.mp4 -vf scale=1920:1080 -c:v libx264 -preset fast \
  -b:v 8M -g 60 -keyint_min 60 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart proxy1080_from4k.mp4
echo "  proxy1080_from4k.mp4"

# I4: keyframe interval sweep. CRF is held, not bitrate, so file size shows the real cost.
for G in 60 30 15 6 1; do
  ffmpeg -y -loglevel error -i 1080p30_gop60.mp4 -c:v libx264 -preset fast -crf 23 \
    -g $G -keyint_min $G -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart gop$G.mp4
  echo "  gop$G.mp4"
done

# I1: no B-frames, so decode order == presentation order and stream copy can mux
ffmpeg -y -loglevel error -i 1080p30_gop60.mp4 -c:v libx264 -preset fast -crf 23 -bf 0 \
  -g 60 -keyint_min 60 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart nobf_1080p30.mp4
echo "  nobf_1080p30.mp4"
