"""Track B — Redis Stream 워커 (realtime + batch).

진입: __main__.py(realtime, python -m app.worker.stream) · batch.py(python -m app.worker.stream.batch).
껍질: runner.py(드라이버) · consumer.py(소비→dispatch_job) · connection.py(Redis client).
"""
