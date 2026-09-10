"""구 배포 명령 호환 — `python -m app.worker`를 stream 워커로 위임.

워커가 `stream`/`event`/`cron` 네임스페이스로 분리되며 구 진입점이 사라졌으나,
기존 k8s/compose 명령(`app.worker`)을 바꾸지 않고 그대로 쓰기 위한 shim.
"""

import runpy

runpy.run_module("app.worker.stream", run_name="__main__")
