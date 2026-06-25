# Claude Code 沙箱模板

对齐 e2b 官方 [`claude`](https://e2b.dev/docs/agents/claude-code) 模板，基于
本仓库的 `agents-base` 模板叠加 [Claude Code CLI](https://docs.claude.com/claude-code)、
Claude 本地状态和常用 MCP servers。

## 镜像内容

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| 基础模板 | `agents-base` | 继承 e2bdev/base、Node.js、基础开发/排障工具、GitHub CLI 和前端脚手架 |
| `@anthropic-ai/claude-code` | `latest` | Claude Code CLI |
| `@modelcontextprotocol/server-*` | `latest` | 预装 filesystem / memory / sequential-thinking MCP server |
| `/home/user/.claude.json` | 预置 | 跳过 Claude Code 首次交互 onboarding |

> 镜像内不内置任何 API key，认证信息通过沙箱创建时的 `envs` 注入。

> 模板会预置 Claude Code 的本地 onboarding 状态。这样使用
> `ANTHROPIC_BASE_URL` 指向第三方 Anthropic-compatible 网关时，交互模式
> `claude` 不会先卡在官方服务连通性检查；模型请求仍由运行时环境变量控制。

## 模板继承说明

`qshell.sandbox.toml` 使用 `from_template = "agents-base"`，真实 base 来自已构建的
`agents-base` 模板。当前 Dockerfile 中的 `FROM scratch` 仅用于 qshell 解析 Dockerfile，
不会作为基础镜像拉取。

构建本模板前，请先构建并发布 `examples/sandbox_agent_templates/agents-base`。

## 构建（通过 qshell.sandbox.toml 幂等）

```bash
cd examples/sandbox_agent_templates/claude

# 首次构建 + 后续重建：命令完全一样
qshell sandbox template build --wait

# 忽略缓存强制完整重建
qshell sandbox template build --no-cache --wait
```

qshell 会从当前目录的 `qshell.sandbox.toml` 读取 `name` / `from_template` /
`dockerfile` / `cpu_count` / `memory_mb` 等字段，并按 `name` 定位模板
（环境内全局唯一）。首次构建和后续重建使用同一条命令；不同账号或环境也不需要
手动维护 `template_id`。

> 建议使用最新版 qshell 构建和发布模板。

CLI flag 优先于配置文件，可临时覆盖：

```bash
# 临时调大内存，不改 qshell.sandbox.toml
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

sbx = Sandbox(
    "claude",
    envs={
        "ANTHROPIC_API_KEY": "sk-ant-...",
        # 可选：使用第三方 Anthropic-compatible 网关
        "ANTHROPIC_BASE_URL": "https://api.qnaigc.com",
    },
)

result = sbx.commands.run(
    "claude -p 'create a FastAPI hello world app' --output-format json"
)
print(result.stdout)
```

```javascript
import { Sandbox } from 'e2b'

const sbx = await Sandbox.create('claude', {
  envs: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    // 可选：使用第三方 Anthropic-compatible 网关
    ANTHROPIC_BASE_URL: 'https://api.qnaigc.com',
  },
})

const res = await sbx.commands.run(
  `claude -p 'write a hello world in python'`
)
console.log(res.stdout)
```

## 配合 sandbox injection-rule 使用

如果通过 `qshell sandbox injection-rule` 创建了类型为 `anthropic` 的注入规则，
让 MITM 在网络层改写 `x-api-key`，CLI 端需要满足两个条件才能命中规则：

1. **`ANTHROPIC_BASE_URL` 必须等于规则的 `target`**：MITM 按 SNI hostname 匹配，
   CLI 默认访问 `api.anthropic.com`，与规则的 `Hosts`（即 `target` 主机名）
   不一致时不会被拦截，请求会直连官方 Anthropic。
2. **`ANTHROPIC_API_KEY` 设为任意非空占位符**：CLI 在本地校验阶段需要 key
   才会发请求；真实 key 由 MITM 注入到 header，本地的占位符值不会被外发。

```bash
# 假设规则 target = https://api.qnaigc.com
qshell sbx cr claude \
    --injection-rule <rule-id> \
    -e ANTHROPIC_API_KEY=placeholder \
    -e ANTHROPIC_BASE_URL=https://api.qnaigc.com
```

> 多条同 host 规则只有第一条生效（MITM 首匹配返回）；同一沙箱内 CLI 只能
> 指向一个 `ANTHROPIC_BASE_URL`，因此实际只会触发该 host 对应的那条规则。

## 与官方 e2b `claude` 模板的差异

| 维度 | e2b 官方 | 本模板 |
| --- | --- | --- |
| 基础来源 | `e2bdev/base` | 通过 `agents-base` 继承 |
| Claude Code CLI | ✅ | ✅ |
| git | ✅ | ✅ |
| ripgrep | ⚠️ 未确认 | ✅ |
| vim | ❌ | ✅ |
| 常用排障工具 | ❌ | ✅（jq / less / tree / zip / unzip / procps / lsof / nc / dig / ping） |
| GitHub CLI | ❌ | ✅ |
| 前端脚手架 | ❌ | ✅（pnpm / yarn / tsx / vite） |
| MCP servers | ❌ | ✅（filesystem / memory / sequential-thinking） |

公共工具由 `agents-base` 统一维护，本模板 Dockerfile 只包含 Claude Code、
Claude 本地状态和 MCP servers 的增量安装。
