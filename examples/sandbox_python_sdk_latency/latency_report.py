#!/usr/bin/env python3
"""Create a sandbox with Qiniu Python SDK and print a timing report."""

from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Sequence

from qiniu import Sandbox


REGION_ENDPOINTS = {
    "cn-yangzhou-1": "https://cn-yangzhou-1-sandbox.qiniuapi.com",
    "us-south-1": "https://us-south-1-sandbox.qiniuapi.com",
}
DEFAULT_REGIONS = tuple(REGION_ENDPOINTS)
DEFAULT_TEMPLATE = "code-interpreter-v1"
DEFAULT_COMMAND = 'echo "hello from sandbox"; echo $((1 + 1))'


@dataclass
class Step:
    region: str
    name: str
    started_at: datetime
    ended_at: datetime
    duration: float
    ok: bool
    output: str


def main() -> int:
    args = parse_args()

    print("Qiniu Python SDK sandbox example")
    print(f"regions:  {', '.join(args.regions)}")
    print(f"template: {args.template}")
    print()

    results: list[RegionResult] = []
    for region in args.regions:
        results.append(run_region(args, region))

    print_summary(args, results)
    return 0 if all(result.ok for result in results) else 1


@dataclass
class RegionResult:
    region: str
    endpoint: str
    sandbox_id: str
    steps: list[Step]

    @property
    def ok(self) -> bool:
        return bool(self.steps) and all(step.ok for step in self.steps)


def run_region(args: argparse.Namespace, region: str) -> RegionResult:
    endpoint = REGION_ENDPOINTS[region]
    api_key = args.api_key
    steps: list[Step] = []
    sandbox = None
    sandbox_id = ""

    print(f"========== Region: {region} ==========")
    print(f"endpoint: {endpoint}")
    print()

    create_step, sandbox = run_step(
        region,
        "create sandbox",
        lambda: Sandbox.create(
            args.template,
            endpoint=endpoint,
            api_key=api_key,
            timeout=args.timeout,
        ),
    )
    steps.append(create_step)
    if not create_step.ok:
        print_region_report(args, region, endpoint, sandbox_id, steps)
        return RegionResult(region, endpoint, sandbox_id, steps)

    sandbox_id = getattr(sandbox, "sandbox_id", "") or ""
    if not sandbox_id:
        print("cannot find sandbox ID in SDK response")
        steps[-1].ok = False
        print_region_report(args, region, endpoint, sandbox_id, steps)
        return RegionResult(region, endpoint, sandbox_id, steps)

    print(f"sandbox id: {sandbox_id}")
    print()

    try:
        exec_step, _ = run_step(
            region,
            "run code",
            lambda: sandbox.commands.run(args.command),
        )
        steps.append(exec_step)
    finally:
        if sandbox is not None:
            kill_step, _ = run_step(
                region,
                "kill sandbox",
                lambda: sandbox.kill(),
            )
            steps.append(kill_step)

    print_region_report(args, region, endpoint, sandbox_id, steps)
    return RegionResult(region, endpoint, sandbox_id, steps)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a simple Qiniu Python SDK sandbox example.")
    parser.add_argument(
        "--api-key-file",
        default="",
        help="file containing the sandbox API key; defaults to QINIU_API_KEY env",
    )
    parser.add_argument(
        "--region",
        action="append",
        dest="regions",
        help="sandbox region to run; repeat to compare selected regions; default: all regions",
    )
    parser.add_argument("--template", default=DEFAULT_TEMPLATE)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--command", default=DEFAULT_COMMAND)
    args = parser.parse_args()

    args.regions = [region.strip() for region in (args.regions or DEFAULT_REGIONS) if region.strip()]
    if not args.regions:
        parser.error("at least one --region is required")
    unknown_regions = [region for region in args.regions if region not in REGION_ENDPOINTS]
    if unknown_regions:
        parser.error(
            "unsupported region: "
            + ", ".join(unknown_regions)
            + "; supported regions: "
            + ", ".join(REGION_ENDPOINTS)
        )
    args.api_key_file = args.api_key_file.strip()
    args.api_key = read_api_key_file(args.api_key_file) or os.getenv("QINIU_API_KEY", "").strip()
    if not args.api_key:
        parser.error(
            "API key is required. Please provide --api-key-file or set the QINIU_API_KEY environment variable."
        )
    args.template = args.template.strip() or DEFAULT_TEMPLATE
    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    return args


def read_api_key_file(path: str) -> str:
    if not path:
        return ""
    with open(path, "r", encoding="utf-8") as file:
        return file.read().strip()


def run_step(
    region: str,
    name: str,
    fn,
) -> tuple[Step, object]:
    started_at = datetime.now().astimezone()
    started = time.perf_counter()

    print(f"==> {name}")
    print(f"start:   {format_time(started_at)}")

    result = None
    output = ""
    ok = True
    try:
        result = fn()
        output = result_output(result)
        ok = result_ok(result)
    except Exception as err:
        ok = False
        output = str(err)
    finally:
        ended_at = datetime.now().astimezone()
        duration = time.perf_counter() - started

    if output:
        print(output)
    print(f"end:     {format_time(ended_at)}")
    print(f"cost:    {format_duration(duration)}")
    print(f"status:  {'ok' if ok else 'failed'}")
    print()

    return (
        Step(
            region=region,
            name=name,
            started_at=started_at,
            ended_at=ended_at,
            duration=duration,
            ok=ok,
            output=output,
        ),
        result,
    )


def result_output(result) -> str:
    if result is None:
        return ""
    stdout = getattr(result, "stdout", "")
    stderr = getattr(result, "stderr", "")
    if stdout or stderr:
        return (stdout + stderr).strip()
    sandbox_id = getattr(result, "sandbox_id", "")
    if sandbox_id:
        return "sandbox_id: {0}".format(sandbox_id)
    return ""


def result_ok(result) -> bool:
    exit_code = getattr(result, "exit_code", getattr(result, "exitCode", None))
    if exit_code is None:
        return True
    return exit_code == 0


def print_region_report(
    args: argparse.Namespace,
    region: str,
    endpoint: str,
    sandbox_id: str,
    steps: Sequence[Step],
) -> None:
    print(f"========== Report: {region} ==========")
    print(f"region:     {region}")
    print(f"endpoint:   {endpoint}")
    print(f"template:   {args.template}")
    if sandbox_id:
        print(f"sandbox_id: {sandbox_id}")
    print()

    print(f"{'step':<16} {'started_at':<29} {'ended_at':<29} {'duration':<10} {'status':<8}")
    for step in steps:
        print(
            f"{step.name:<16} "
            f"{format_time(step.started_at):<29} "
            f"{format_time(step.ended_at):<29} "
            f"{format_duration(step.duration):<10} "
            f"{'ok' if step.ok else 'failed':<8}"
        )

    print()
    for step in steps:
        print(f"{step.name.replace(' ', '_')}_latency: {format_duration(step.duration)}")

    print(f"\nresult: {'ok' if all(step.ok for step in steps) else 'failed'}")
    print()


def print_summary(args: argparse.Namespace, results: Sequence[RegionResult]) -> None:
    print("========== Comparison ==========")
    print(f"template: {args.template}")
    print()
    print(
        f"{'region':<18} {'create':<10} {'run_code':<10} {'kill':<10} "
        f"{'total':<10} {'status':<8}"
    )
    for result in results:
        create = find_step(result.steps, "create sandbox")
        run_code = find_step(result.steps, "run code")
        kill = find_step(result.steps, "kill sandbox")
        total = sum(step.duration for step in result.steps)
        print(
            f"{result.region:<18} "
            f"{format_duration(create.duration) if create else '-':<10} "
            f"{format_duration(run_code.duration) if run_code else '-':<10} "
            f"{format_duration(kill.duration) if kill else '-':<10} "
            f"{format_duration(total):<10} "
            f"{'ok' if result.ok else 'failed':<8}"
        )

    print(f"\nresult: {'ok' if all(result.ok for result in results) else 'failed'}")


def find_step(steps: Sequence[Step], name: str) -> Step | None:
    for step in steps:
        if step.name == name:
            return step
    return None


def format_time(value: datetime) -> str:
    return value.isoformat(timespec="milliseconds")


def format_duration(seconds: float) -> str:
    if seconds < 1:
        return f"{seconds * 1000:.0f}ms"
    return f"{seconds:.3f}s"


if __name__ == "__main__":
    sys.exit(main())
