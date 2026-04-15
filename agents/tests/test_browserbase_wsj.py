import unittest
from unittest.mock import patch

from runtime.browserbase_wsj import (
    _wsj_force_requires_auth_enabled,
    _wsj_session_probe_first_enabled,
    wsj_page_requires_auth,
)


class TestWsjAuthHeuristics(unittest.TestCase):
    def test_accounts_host(self) -> None:
        self.assertTrue(wsj_page_requires_auth(url="https://accounts.wsj.com/login", html_sample="<html></html>"))

    def test_signin_path(self) -> None:
        self.assertTrue(wsj_page_requires_auth(url="https://www.wsj.com/signin", html_sample="<html>ok</html>"))

    def test_dow_jones_sso_host(self) -> None:
        self.assertTrue(
            wsj_page_requires_auth(
                url="https://sso.accounts.dowjones.com/login-page?client_id=x",
                html_sample="<html></html>",
            )
        )

    def test_html_signin_copy(self) -> None:
        html = "<html><body>Sign In to The Wall Street Journal</body></html>"
        self.assertTrue(wsj_page_requires_auth(url="https://www.wsj.com/markets", html_sample=html))

    def test_public_home(self) -> None:
        html = "<html><body>Markets overview</body></html>"
        self.assertFalse(wsj_page_requires_auth(url="https://www.wsj.com/", html_sample=html))

    def test_bot_block_copy(self) -> None:
        html = "<html><body>Access is temporarily restricted. We detected unusual activity.</body></html>"
        self.assertTrue(wsj_page_requires_auth(url="https://www.wsj.com/markets", html_sample=html))

    def test_device_verification_interstitial(self) -> None:
        html = "<html><body>Verifying the device... The requested content will be available after verification.</body></html>"
        self.assertTrue(wsj_page_requires_auth(url="https://www.wsj.com/", html_sample=html))

    def test_wsj_404_copy(self) -> None:
        html = "<html><body>We can't find the page you're looking for.</body></html>"
        self.assertTrue(wsj_page_requires_auth(url="https://www.wsj.com/foo/bar", html_sample=html))


class TestWsjForceRequiresAuthEnv(unittest.TestCase):
    def test_unset_or_empty_is_off(self) -> None:
        with patch.dict("os.environ", {"WSJ_FORCE_REQUIRES_AUTH": ""}, clear=False):
            self.assertFalse(_wsj_force_requires_auth_enabled())

    def test_explicit_false_off(self) -> None:
        for v in ("false", "False", "0", "no", "off"):
            with patch.dict("os.environ", {"WSJ_FORCE_REQUIRES_AUTH": v}, clear=False):
                self.assertFalse(
                    _wsj_force_requires_auth_enabled(),
                    msg=f"expected off for {v!r}",
                )

    def test_true_on(self) -> None:
        for v in ("true", "True", "1", "yes", "on"):
            with patch.dict("os.environ", {"WSJ_FORCE_REQUIRES_AUTH": v}, clear=False):
                self.assertTrue(
                    _wsj_force_requires_auth_enabled(),
                    msg=f"expected on for {v!r}",
                )

    def test_unknown_is_off(self) -> None:
        with patch.dict("os.environ", {"WSJ_FORCE_REQUIRES_AUTH": "maybe"}, clear=False):
            self.assertFalse(_wsj_force_requires_auth_enabled())


class TestWsjSessionProbeFirstEnv(unittest.TestCase):
    def test_explicit_false(self) -> None:
        with patch.dict("os.environ", {"WSJ_SESSION_PROBE_FIRST": "false"}, clear=False):
            self.assertFalse(_wsj_session_probe_first_enabled())

    def test_explicit_true(self) -> None:
        with patch.dict("os.environ", {"WSJ_SESSION_PROBE_FIRST": "true"}, clear=False):
            self.assertTrue(_wsj_session_probe_first_enabled())


if __name__ == "__main__":
    unittest.main()
