from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.modules.auth.login_notification.models import LoginNotification


class CalculateRiskScoreService:
    def execute(self, recent_logins: list[LoginNotification]) -> dict:
        risk_score = 0
        reasons = []

        # 1. 다중 IP 감지 (1시간 내)
        one_hour_ago = utc_now() - timedelta(hours=1)
        recent_ips = {
            login.ip_address
            for login in recent_logins
            if login.login_at >= one_hour_ago
        }

        if len(recent_ips) >= 3:
            risk_score += 40
            reasons.append(f"Multiple IPs in 1 hour: {len(recent_ips)} IPs")

        # 2. 새 디바이스 빈도 감지 (24시간 내)
        new_device_count = sum(1 for login in recent_logins if login.is_new_device)
        if new_device_count >= 5:
            risk_score += 30
            reasons.append(f"Too many new devices in 24 hours: {new_device_count}")

        # 3. 심야 시간대 로그인 빈도 (02:00-05:00)
        night_login_count = sum(
            1 for login in recent_logins if 2 <= login.login_at.hour < 5
        )
        if night_login_count >= 3:
            risk_score += 20
            reasons.append(f"Frequent late-night logins (02:00-05:00): {night_login_count}")

        # 4. IP 변경 빈도 (24시간 내)
        all_ips = {login.ip_address for login in recent_logins}
        if len(all_ips) >= 10:
            risk_score += 30
            reasons.append(f"Too many different IPs in 24 hours: {len(all_ips)}")

        # 위험도 판단
        is_suspicious = risk_score >= 40
        should_lock = risk_score >= 70

        return {
            "is_suspicious": is_suspicious,
            "risk_score": min(risk_score, 100),  # Cap at 100
            "reasons": reasons,
            "should_lock": should_lock,
        }
