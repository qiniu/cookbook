from types import SimpleNamespace

import latency_report


def test_result_ok_detects_command_failure():
    assert latency_report.result_ok(SimpleNamespace(exit_code=1)) is False


def test_result_ok_accepts_successful_command():
    assert latency_report.result_ok(SimpleNamespace(exit_code=0)) is True


def test_result_ok_accepts_non_command_results():
    assert latency_report.result_ok(SimpleNamespace(sandbox_id="sandbox-id")) is True
