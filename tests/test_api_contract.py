from backend.app.config import get_settings


def test_settings_has_app_name():
    settings = get_settings()
    assert settings.app_name

