from playwright.sync_api import Playwright
import os

def pytest_configure(config):
    """Configure Playwright for testing"""
    config.option.headed = os.getenv("HEADED", "false").lower() == "true"
    config.option.browser_name = os.getenv("BROWSER", "chromium")
    config.option.slowmo = int(os.getenv("SLOWMO", "0"))

# Playwright configuration
PLAYWRIGHT_CONFIG = {
    "headless": os.getenv("HEADLESS", "true").lower() == "true",
    "slow_mo": int(os.getenv("SLOWMO", "0")),
    "viewport": {"width": 1280, "height": 720},
    "screenshot": "only-on-failure",
    "video": "retain-on-failure",
    "trace": "retain-on-failure",
}
