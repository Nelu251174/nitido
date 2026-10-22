FROM node:22-bookworm-slim
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates util-linux && rm -rf /var/lib/apt/lists/*
RUN set -eu; backup_arch="${TARGETARCH:-$(dpkg --print-architecture)}"; case "$backup_arch" in amd64) backup_sha=4c9c95bc079a0334e81fad379b19dc5c3353c71c2c88d652cafce2081c2b1c66;; arm64) backup_sha=cef139cbe8b27b16bda731d17f093b0aa466b8c60b136c12d78b6f2bff3daf22;; *) exit 1;; esac; curl --fail --location --proto '=https' --tlsv1.2 --retry 3 "https://github.com/restic/rest-server/releases/download/v0.14.0/rest-server_0.14.0_linux_${backup_arch}.tar.gz" -o /tmp/receiver.tar.gz; printf '%s  /tmp/receiver.tar.gz\n' "$backup_sha" | sha256sum --check --strict; tar -xzf /tmp/receiver.tar.gz -C /tmp; install -m 0755 /tmp/rest-server_0.14.0_linux_${backup_arch}/rest-server /usr/local/bin/rest-server; rm -rf /tmp/receiver.tar.gz /tmp/rest-server_0.14.0_linux_${backup_arch}
WORKDIR /app
COPY receiver.mjs /app/receiver.mjs
RUN mkdir -p /data && chown node:node /data
EXPOSE 8000
CMD ["sh","-c","chown node:node /data && exec setpriv --reuid=node --regid=node --init-groups node receiver.mjs"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD node -e "const https=require('node:https'),{X509Certificate}=require('node:crypto'),ca=Buffer.from(process.env.NITIDO_RECEIVER_TLS_CERT_BASE64,'base64'),cert=new X509Certificate(ca),servername=cert.subject.match(/CN=([^\\n]+)/)[1];https.get({hostname:'127.0.0.1',port:8000,path:'/_nitido-backup-health',servername,ca,headers:{'x-nitido-health':process.env.NITIDO_RECEIVER_HEALTH_TOKEN}},r=>{r.resume();process.exitCode=r.statusCode===200?0:1}).on('error',()=>{process.exitCode=1})"
