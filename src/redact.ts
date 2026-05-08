const REDACTION_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "authorization",
    pattern: /\b(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s\r\n;]+/gi,
  },
  {
    label: "token",
    pattern: /\b((?:access|refresh|tenant|user|app)?[_-]?token\s*[:=]\s*)["']?[a-z0-9._~+/=-]{16,}["']?/gi,
  },
  {
    label: "secret",
    pattern: /\b((?:app[_-]?secret|client[_-]?secret|secret)\s*[:=]\s*)["']?[^"'\s]{8,}["']?/gi,
  },
  {
    label: "password",
    pattern: /\b((?:password|passwd|pwd)\s*[:=]\s*)["']?[^"'\s]{4,}["']?/gi,
  },
  {
    label: "cookie",
    pattern: /\b(cookie\s*[:=]\s*)[^\r\n]{12,}/gi,
  },
  {
    label: "jdbc",
    pattern: /\bjdbc:[^\s"'`]+/gi,
  },
  {
    label: "mysql",
    pattern: /\b(mysql:\/\/)[^\s"'`]+/gi,
  },
  {
    label: "postgres",
    pattern: /\b(postgres(?:ql)?:\/\/)[^\s"'`]+/gi,
  },
  {
    label: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
];

export function detectSensitiveLabels(text: string): string[] {
  const labels = new Set<string>();
  for (const rule of REDACTION_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    if (pattern.test(text)) {
      labels.add(rule.label);
    }
  }
  return [...labels];
}

export function redactText(text: string): string {
  let output = text;
  for (const rule of REDACTION_RULES) {
    output = output.replace(rule.pattern, (match, prefix = "") => {
      if (typeof prefix === "string" && prefix.length > 0 && match.startsWith(prefix)) {
        return `${prefix}[REDACTED:${rule.label}]`;
      }
      return `[REDACTED:${rule.label}]`;
    });
  }
  return output;
}
