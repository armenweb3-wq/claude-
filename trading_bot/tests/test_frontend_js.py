"""Guard: the inline JavaScript in the SaaS frontend must parse. A syntax error
here blanks the whole app (it happened once), so we fail the build instead."""
import os
import re
import shutil
import subprocess

import pytest

_HERE = os.path.dirname(__file__)
_APP = os.path.join(_HERE, "..", "app", "saas", "web", "app.html")


@pytest.mark.skipif(shutil.which("node") is None, reason="node not available")
def test_app_inline_js_parses(tmp_path):
    html = open(_APP, encoding="utf-8").read()
    js = "\n".join(re.findall(r"<script>(.*?)</script>", html, re.S))
    assert js.strip(), "no inline script found"
    f = tmp_path / "app.js"
    f.write_text(js, encoding="utf-8")
    r = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
    assert r.returncode == 0, f"app.html JS syntax error:\n{r.stderr}"
