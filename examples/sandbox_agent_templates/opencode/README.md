# opencode CLI 沙箱模板

对齐 e2b 官方 [`opencode`](https://e2b.dev/docs/agents/opencode) 模板，基于
本仓库的 `agents-base` 模板叠加 [opencode](https://opencode.ai) CLI。

## 镜像内容

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| 基础模板 | `agents-base` | 继承 e2bdev/base、Node.js、基础开发/排障工具、GitHub CLI 和前端脚手架 |
| `opencode-ai` | `latest` | opencode CLI |

> 镜像内不内置任何 API key，认证信息通过沙箱创建时的 `envs` 注入。
> opencode 支持多供应商：`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` 等。

## 模板继承说明

`qshell.sandbox.toml` 使用 `from_template = "agents-base"`，真实 base 来自已构建的
`agents-base` 模板。当前 Dockerfile 中的 `FROM scratch` 仅用于 qshell 解析 Dockerfile，
不会作为基础镜像拉取。

构建本模板前，请先构建并发布 `examples/sandbox_agent_templates/agents-base`。

## 构建（通过 qshell.sandbox.toml 幂等）

```bash
cd examples/sandbox_agent_templates/opencode

# 首次构建 + 后续重建：命令完全一样
qshell sandbox template build --wait

# 忽略缓存强制完整重建：
qshell sandbox template build --no-cache --wait
```

qshell 会从当前目录的 `qshell.sandbox.toml` 读取 `name` / `from_template` /
`dockerfile` / `cpu_count` / `memory_mb` 等字段，并按 `name` 定位模板
（环境内全局唯一）。首次构建和后续重建使用同一条命令；不同账号或环境也不需要
手动维护 `template_id`。

> 建议使用最新版 qshell 构建和发布模板。

CLI flag 优先于配置文件，因此可以临时覆盖任意字段：

```bash
# 临时调大内存，但不改 qshell.sandbox.toml
qshell sandbox template build --memory 16384 --wait
```

## 发布 / 查看 / 删除

以下命令会从当前目录 `qshell.sandbox.toml` 按 `name` 自动定位模板：

```bash
qshell sandbox template publish -y    # 发布
qshell sandbox template get           # 查看详情
qshell sandbox template unpublish -y  # 取消发布
qshell sandbox template delete -y     # 删除模板
```

## 在沙箱中使用

```python
from e2b import Sandbox

sbx = Sandbox("opencode", envs={"ANTHROPIC_API_KEY": "sk-ant-..."})

result = sbx.commands.run(
    "opencode run 'create a FastAPI hello world app'"
)
print(result.stdout)
```

```javascript
import { Sandbox } from 'e2b'

const sbx = await Sandbox.create('opencode', {
  envs: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
})

const res = await sbx.commands.run(
  `opencode run "write a hello world in python"`
)
console.log(res.stdout)
```

### 以服务模式运行

opencode 支持以 HTTP 服务形式暴露能力（默认端口 4096）：

```bash
opencode serve --hostname 0.0.0.0 --port 4096
```

## 与官方 e2b `opencode` 模板的差异

| 维度 | e2b 官方 | 本模板 |
| --- | --- | --- |
| 基础来源 | `e2bdev/base` | 通过 `agents-base` 继承 |
| opencode CLI | ✅ | ✅ |
| git / ripgrep / vim | ✅ / ⚠️ 未确认 / ❌ | ✅ / ✅ / ✅ |
| 常用排障工具 | ❌ | ✅（jq / less / tree / zip / unzip / procps / lsof / nc / dig / ping） |
| GitHub CLI | ❌ | ✅ |
| 前端脚手架 | ❌ | ✅（pnpm / yarn / tsx / vite） |

公共工具由 `agents-base` 统一维护，本模板 Dockerfile 只包含 opencode CLI 的增量安装。
