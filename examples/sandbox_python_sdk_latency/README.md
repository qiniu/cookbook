# Sandbox Python SDK 延迟示例

这个示例演示如何使用 [Qiniu Python SDK](https://github.com/qiniu/python-sdk) 完成最基本的沙箱流程，并对当前两个沙箱区域分别打印时间：

1. 创建一个沙箱。
2. 在沙箱里执行一段简单代码。
3. 打印每一步的开始时间、结束时间和耗时。
4. 退出时自动清理沙箱。

示例不注入任何密钥，默认使用公开模板 `code-interpreter-v1`。
运行前需要提供沙箱 API Key；认证只供 SDK 调用沙箱 API 使用，不会传入沙箱环境。

## 安装依赖

如果服务器上还没有 `pip` / `venv`，先安装：

```bash
apt-get update
apt-get install -y python3-pip python3-venv
```

建议使用虚拟环境安装依赖，避免 Debian/Ubuntu 的系统 Python 触发 `externally-managed-environment`：

```bash
cd examples/sandbox_python_sdk_latency
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
```

当前沙箱模块需要 Qiniu Python SDK `v7.18.0`。如果 PyPI 还没有同步该版本，`requirements.txt` 会直接从 GitHub tag 安装：

```text
qiniu @ https://github.com/qiniu/python-sdk/archive/refs/tags/v7.18.0.zip
```

之后在同一个 shell 里运行示例：

```bash
python latency_report.py
```

## 环境变量

Python SDK 需要客户端侧认证信息：

- `QINIU_API_KEY`：必填，供 SDK 调用沙箱 API。

在 shell 中可以这样指定：

```bash
read -rsp "QINIU_API_KEY: " QINIU_API_KEY
echo
export QINIU_API_KEY
python3 examples/sandbox_python_sdk_latency/latency_report.py
```

也可以把 API Key 放在本地文件中，再通过参数指定文件路径，避免密钥进入 shell history 或进程列表：

```bash
umask 077
read -rsp "QINIU_API_KEY: " QINIU_SANDBOX_API_KEY
echo
printf '%s\n' "$QINIU_SANDBOX_API_KEY" > /tmp/qiniu-sandbox-api-key
unset QINIU_SANDBOX_API_KEY
chmod 600 /tmp/qiniu-sandbox-api-key
python3 examples/sandbox_python_sdk_latency/latency_report.py --api-key-file /tmp/qiniu-sandbox-api-key
```

脚本已经内置当前两个区域对应的 API 地址：

- `cn-yangzhou-1`
- `us-south-1`

Python 中会根据区域把 endpoint 和 API Key 直接传给 SDK：

```python
from qiniu import Sandbox

sandbox = Sandbox.create(
    "code-interpreter-v1",
    endpoint="https://cn-yangzhou-1-sandbox.qiniuapi.com",
    api_key=api_key,
    timeout=120,
)
```

注意：这里的 API Key 是给本机 SDK 客户端用的，不会作为沙箱内环境变量注入。脚本没有传 `envs`。

## 运行

```bash
python3 examples/sandbox_python_sdk_latency/latency_report.py
```

脚本默认会依次测试当前两个区域：

- `cn-yangzhou-1`
- `us-south-1`

默认参数：

- 模板：`code-interpreter-v1`
- 超时：`120` 秒

可以只测试某个区域，或切换模板：

```bash
python3 examples/sandbox_python_sdk_latency/latency_report.py --region cn-yangzhou-1
python3 examples/sandbox_python_sdk_latency/latency_report.py --region us-south-1 --template base
```

当前公开模板包含 `base` 和 `code-interpreter-v1`。这个示例默认用 `code-interpreter-v1`；示例代码只依赖 Bash，因此也可以直接改用 `--template base`。

输出中会分别展示每个区域的创建沙箱、执行代码、清理沙箱三个阶段的开始时间、结束时间和耗时，并在最后给出区域对比：

```text
========== Report: cn-yangzhou-1 ==========
step             started_at                    ended_at                      duration   status
create sandbox   2026-06-30T14:30:00.000+08:00 2026-06-30T14:30:01.000+08:00 1.000s     ok
run code         2026-06-30T14:30:01.000+08:00 2026-06-30T14:30:01.300+08:00 300ms      ok
kill sandbox     2026-06-30T14:30:01.300+08:00 2026-06-30T14:30:01.500+08:00 200ms      ok

========== Comparison ==========
region             create     run_code   kill       total      status
cn-yangzhou-1      1.000s     300ms      200ms      1.500s     ok
us-south-1         1.200s     420ms      250ms      1.870s     ok
```
