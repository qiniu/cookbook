# DeepSeek Harness Web UI 沙箱模板

本模板基于 `agents-base`，预装固定版本的
[`@deepseek-ai/dsh`](https://github.com/deepseek-ai/deepseek-harness)，并通过
8080 端口提供带登录保护的 DeepSeek Harness Web UI。

## 镜像内容

| 组件 | 版本 / 端口 | 说明 |
| --- | --- | --- |
| `agents-base` | 模板继承 | Node.js、Git、Python 和常用排障工具 |
| `@deepseek-ai/dsh` | `0.1.2-alpha.5` | DeepSeek Harness CLI 与 Web UI |
| Harness | `127.0.0.1:3080` | 仅供沙箱内网关访问 |
| 网关 | `0.0.0.0:8080` | 浏览器入口和登录会话 |

模板镜像不包含 API key、Web UI 密码或会话 token。创建沙箱时通过 `envs` 注入
`DEEPSEEK_API_KEY` 和 `DSH_WEB_PASSWORD`，并通过 SDK 执行 `start.sh`，让运行时进程
继承这些配置。

SDK 控制面凭据只在调用方进程中使用，不会注入沙箱：七牛 SDK 使用
`QINIU_API_KEY` 和 `QINIU_SANDBOX_API_URL`，兼容 E2B SDK 的调用方也可以使用
`E2B_API_KEY` 和 `E2B_API_URL`。`DEEPSEEK_API_KEY` 与 `DSH_WEB_PASSWORD` 才是需要
通过创建请求的 `envs` 传入沙箱的运行时配置。

## 构建与发布

```bash
cd examples/sandbox_agent_templates/agents-base
qshell sandbox template build --wait
qshell sandbox template publish -y

cd ../deepseek-harness
qshell sandbox template build --wait
qshell sandbox template publish -y
```

也可以从 `examples/sandbox_agent_templates` 目录执行：

```bash
make build-deepseek-harness
make publish-deepseek-harness
```

模板按 `name` 自动定位，配置中不需要维护环境相关的 `template_id`。建议使用最新版
qshell。

## 创建沙箱并访问 Web UI

下面示例使用 Python SDK。`DSH_WEB_PASSWORD` 应由调用方从密钥存储读取，不能写入日志、
URL 或前端代码；示例等待 `/_health` 返回 200 后才输出浏览器地址。

```python
import os
import time
import urllib.request

from e2b import Sandbox


def required_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


password = required_env("DSH_WEB_PASSWORD")
sbx = Sandbox.create(
    "deepseek-harness",
    timeout=3600,
    secure=True,
    network={"allowPublicTraffic": True},
    envs={
        "DEEPSEEK_API_KEY": required_env("DEEPSEEK_API_KEY"),
        "DEEPSEEK_BASE_URL": os.environ.get(
            "DEEPSEEK_BASE_URL", "https://api.deepseek.com"
        ),
        "DSH_HOME": "/home/user/.dsh",
        "DSH_WEB_USER": os.environ.get("DSH_WEB_USER", "sandbox"),
        "DSH_WEB_PASSWORD": password,
    },
)

sbx.commands.run("/opt/deepseek-harness/start.sh")
web_url = f"https://{sbx.get_host(8080)}"
for _ in range(30):
    try:
        with urllib.request.urlopen(f"{web_url}/_health", timeout=3) as response:
            if response.status == 200:
                break
    except Exception:
        time.sleep(1)
else:
    raise RuntimeError("DeepSeek Harness gateway is not ready")

print(f"Open {web_url} and sign in with the configured DSH_WEB_USER")
```

打开 `web_url` 后使用 `DSH_WEB_USER` 和 `DSH_WEB_PASSWORD` 登录。网关会为登录后的
HTTP、SSE 和 WebSocket 请求设置并复用 `HttpOnly`、`Secure`、`SameSite=Strict` Cookie。
使用完成后删除沙箱：

```python
sbx.kill()
```

## 环境变量

| 变量 | 必需 | 默认值 | 用途 |
| --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | 是 | 无 | DeepSeek 模型访问凭据 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | 模型 API 地址 |
| `DEEPSEEK_SEARCH_BASE_URL` | 否 | 上游默认值 | 搜索服务地址 |
| `DSH_HOME` | 否 | `/home/user/.dsh` | Harness 配置和会话目录 |
| `DSH_WEB_USER` | 否 | `sandbox` | Web UI 登录用户名 |
| `DSH_WEB_PASSWORD` | 是 | 无 | Web UI 登录密码，UTF-8 编码至少 16 字节 |

## 故障排查

```bash
curl -i http://127.0.0.1:8080/_health
cat /tmp/deepseek-harness/dsh.log
cat /tmp/deepseek-harness/gateway.log
cat /tmp/deepseek-harness/supervisor.log
ss -lntp | grep -E ':3080|:8080'
```

`/_health` 只有在 Harness 后端可达时返回 200。运行时缺少 `DEEPSEEK_API_KEY` 时无法
调用模型，缺少 `DSH_WEB_PASSWORD` 时网关不会提供可用的登录凭据。
