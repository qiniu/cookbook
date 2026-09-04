# DeepSeek Harness Web UI sandbox template.
# The actual base layer is selected by qshell.sandbox.toml.
FROM scratch

WORKDIR /home/user

# Pin the developer-preview release so rebuilds are reproducible.
RUN npm install -g \
        --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs \
        @deepseek-ai/dsh@0.1.2-alpha.5 \
    && npm cache clean --force

COPY start.sh /opt/deepseek-harness/start.sh
COPY supervisor.mjs /opt/deepseek-harness/supervisor.mjs
COPY web-gateway.mjs /opt/deepseek-harness/web-gateway.mjs

RUN chmod 755 /opt/deepseek-harness/start.sh \
    && node --check /opt/deepseek-harness/supervisor.mjs \
    && node --check /opt/deepseek-harness/web-gateway.mjs \
    && dsh --version
