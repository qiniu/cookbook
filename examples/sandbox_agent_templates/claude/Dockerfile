# Claude Code sandbox template
# 基于 agents-base 模板叠加 Claude Code CLI、Claude 本地状态和 MCP servers。
# 运行时通过 ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL 环境变量注入认证信息
#
# 使用 qshell 的 from_template + dockerfile 构建能力时，真实 base 来自
# qshell.sandbox.toml 中的 from_template；这里的 FROM 仅用于 Dockerfile 解析。
FROM scratch

# Claude Code CLI
# 说明：统一使用 @latest，保证每次 rebuild 拿到最新能力
RUN npm install -g @anthropic-ai/claude-code@latest \
    && npm cache clean --force

# Claude Code 交互模式首次启动前会进行官方服务连通性检查。预置本地
# onboarding 状态，避免第三方 Anthropic-compatible 网关场景下卡在该检查。
# 这里不写入任何 API key / base URL，认证信息仍然必须在运行时注入。
RUN mkdir -p /home/user \
    && printf '%s\n' \
        '{' \
        '  "theme": "dark",' \
        '  "hasCompletedOnboarding": true,' \
        '  "lastOnboardingVersion": "2.1.118",' \
        '  "hasTrustDialogAccepted": true' \
        '}' \
        > /home/user/.claude.json \
    && chown user:user /home/user/.claude.json

# 预装常用 MCP servers，Claude 可直接通过 `claude mcp` 启用
RUN npm install -g \
        @modelcontextprotocol/server-filesystem@latest \
        @modelcontextprotocol/server-memory@latest \
        @modelcontextprotocol/server-sequential-thinking@latest \
    && npm cache clean --force

# 默认工作目录：继承 agents-base / e2bdev/base 约定
WORKDIR /home/user

# 构建期验证：核心工具缺失时直接失败，避免发布不可用模板。
RUN claude --version \
    && gh --version \
    && node --version \
    && python3 --version
