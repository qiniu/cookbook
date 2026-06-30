from types import SimpleNamespace
from unittest.mock import patch

import pytest
import latency_report


def test_result_ok_detects_command_failure():
    assert latency_report.result_ok(SimpleNamespace(exit_code=1)) is False


def test_result_ok_accepts_successful_command():
    assert latency_report.result_ok(SimpleNamespace(exit_code=0)) is True


def test_result_ok_accepts_non_command_results():
    assert latency_report.result_ok(SimpleNamespace(sandbox_id="sandbox-id")) is True


def test_parse_args_requires_api_key(monkeypatch):
    monkeypatch.delenv("QINIU_API_KEY", raising=False)
    with patch("sys.argv", ["latency_report.py"]), pytest.raises(SystemExit):
        latency_report.parse_args()


def test_parse_args_uses_api_key_env(monkeypatch):
    monkeypatch.setenv("QINIU_API_KEY", "sk-test")
    with patch("sys.argv", ["latency_report.py"]):
        args = latency_report.parse_args()
    assert args.api_key == "sk-test"


def test_parse_args_uses_api_key_file(monkeypatch, tmp_path):
    monkeypatch.delenv("QINIU_API_KEY", raising=False)
    key_file = tmp_path / "api-key"
    key_file.write_text("sk-file\n", encoding="utf-8")
    with patch("sys.argv", ["latency_report.py", "--api-key-file", str(key_file)]):
        args = latency_report.parse_args()
    assert args.api_key == "sk-file"
