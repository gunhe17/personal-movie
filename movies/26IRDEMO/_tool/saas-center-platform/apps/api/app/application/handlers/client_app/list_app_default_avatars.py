from app.modules.client.profile.default_avatars import list_default_avatars
from app.modules.client_app.schemas import AppDefaultAvatarItem


async def list_app_default_avatars_handler() -> list[AppDefaultAvatarItem]:
    return [
        AppDefaultAvatarItem(key=key, gender=gender, url=url)
        for key, gender, url in list_default_avatars()
    ]
