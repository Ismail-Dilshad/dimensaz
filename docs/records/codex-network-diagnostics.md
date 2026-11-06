# Codex network diagnostics

## Effective session
- Sandbox: workspace-write; managed restricted filesystem.
- Network: restricted; CODEX_SANDBOX_NETWORK_DISABLED=1.
- Approval: granular; sandbox_approval, rules, skill_approval disabled; mcp_elicitations permitted. No escalation requested.
- User config: C:/Users/esma3/.codex/config.toml. Read only; unchanged.
- Saved Windows selection: unelevated. No sandbox_workspace_write.network_access entry.
- Native Windows, WSL setting false. CLI 0.164.0-alpha.11.1.
- Process is current user, low integrity, administrators deny-only. LOCALAPPDATA redirects to a per-command Packages/sandbox.{GUID}/AC path. This suggests native container isolation/MXC, but exact effective implementation is not conclusively identified by the available logs. Saved unelevated is not proof of active implementation.
- Windows registry: DisplayVersion 26H2, build 26300.9711. ProductName says Windows 10 Pro; branding string may be stale, so build is recorded rather than inferring edition.

## Tests performed
DNS getaddrinfo failed with Windows error 11001 for pypi.org, registry.npmjs.org, github.com, huggingface.co.
HTTPS urllib requests with normal certificate validation to https://pypi.org/robots.txt, https://registry.npmjs.org/-/ping and https://github.com/robots.txt all failed at DNS. No TLS handshake or provider response occurred.
Small download attempt: pypi.org/robots.txt failed; no downloaded file created.
No HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY/SSL_CERT_FILE/REQUESTS_CA_BUNDLE entries found in the command environment.
WinHTTP inspection: netsh winhttp show proxy returned command not found despite netsh resolving to System32. Registry proxy fields returned no values. Host proxy configuration is therefore not conclusively established.
Authorized built-in browser attempt: createBrowserTab(iab, https://pypi.org/robots.txt) failed before navigation with: failed to write kernel assets: The system cannot find the path specified. (os error 3).
Hosted web retrieval worked, but that is a separate service and does not verify command-network connectivity.

## Logs inspected
C:/Users/esma3/.codex/.sandbox/sandbox-d05f336672e662d7.log
- 2026-10-25: legacy online/offline sandbox accounts provisioned.
- Offline-user TCP/UDP firewall rules configured.
- WFP setup succeeded with 12 filters.
C:/Users/esma3/.codex/.sandbox/sandbox.2026-10-25.log
- Filesystem helper starts; tail contains no conclusive current network failure.
These are historical setup records, not evidence that the current user process is blocked by the offline-user rule. No secret files were read or copied.

## Conclusion and safe next step
The session explicitly has networking disabled. DNS error alone does not prove Windows DNS is broken. No evidence currently establishes a certificate or remote-provider error. Host firewall/DNS/proxy cannot be excluded independently from this restricted process.

Official documentation supports this additive user setting for workspace-write:
[sandbox_workspace_write]
network_access = true

The user configuration is outside this session's writable roots and sandbox escalation is disabled. It was not modified. User must add the section through their own editor, preserve other settings, then fully quit and reopen the hosting desktop application and start a fresh task. Managed host permissions may override it. Never unset the environment marker or remove firewall rules to bypass enforcement.

If a fresh session still disables networking despite the setting, collect its effective permissions plus fresh sandbox logs and report it to OpenAI. The current findings match documented intentionally offline sessions; they do not prove a Windows sandbox defect after correct configuration.

Sources:
https://learn.chatgpt.com/docs/agent-approvals-security
https://learn.chatgpt.com/docs/windows/windows-sandbox
https://learn.chatgpt.com/docs/config-file/config-reference

Downloads are NOT working in this session. No TLS settings, firewall rules, sandbox modes or existing configuration were changed.
