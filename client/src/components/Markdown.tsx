import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-md border border-card-border bg-background">
      <div className="flex items-center justify-between border-b border-card-border bg-muted/60 px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{lang || "Code"}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          data-testid="button-copy-code"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Kopiert" : "Kopieren"}
        </Button>
      </div>
      <pre className="spark-scroll overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:text-base prose-headings:font-semibold prose-pre:bg-transparent prose-pre:p-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children: kids, ...props }: any) {
            const text = String(kids).replace(/\n$/, "");
            const match = /language-(\w+)/.exec(className || "");
            if (inline || (!match && !text.includes("\n"))) {
              return (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props}>
                  {kids}
                </code>
              );
            }
            return <CodeBlock code={text} lang={match?.[1]} />;
          },
          pre({ children: kids }: any) {
            return <>{kids}</>;
          },
          a({ children: kids, href }: any) {
            return (
              <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                {kids}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
