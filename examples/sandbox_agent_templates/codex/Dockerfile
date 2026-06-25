# Codex CLI sandbox template
# 基于 agents-base 模板叠加 OpenAI Codex CLI。
# 运行时通过 OPENAI_API_KEY 环境变量注入认证信息（Codex CLI 上游使用此变量名）
#
# 使用 qshell 的 from_template + dockerfile 构建能力时，真实 base 来自
# qshell.sandbox.toml 中的 from_template；这里的 FROM 仅用于 Dockerfile 解析。
FROM scratch

# OpenAI Codex CLI
# 说明：统一使用 @latest，保证每次 rebuild 拿到最新能力
RUN npm install -g @openai/codex@latest \
    && npm cache clean --force

# 默认工作目录：继承 agents-base / e2bdev/base 约定
WORKDIR /home/user

# 构建期验证：核心工具缺失时直接失败，避免发布不可用模板。
RUN codex --version \
    && gh --version \
    && node --version \
    && python3 --version
