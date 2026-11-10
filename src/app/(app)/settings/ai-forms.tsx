"use client";

import { useActionState, useState, useTransition } from "react";
import { PlugZap, Save, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/input";
import {
  removeApiKeyAction,
  saveApiKeyAction,
  saveModelAction,
  testConnectionAction,
  type FormState,
} from "./actions";

type KeyStatus = { configured: false } | { configured: true; last4: string; updatedAt: string };

export function ApiKeyForm({ status, disabled }: { status: KeyStatus; disabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveApiKeyAction, {});
  const [testResult, setTestResult] = useState<FormState | null>(null);
  const [testing, startTest] = useTransition();
  const [removing, startRemove] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-muted">Status:</span>
        {status.configured ? (
          <>
            <Badge tone="success">Key saved</Badge>
            <span className="tabular font-mono text-xs text-ink-muted">ending in {status.last4}</span>
          </>
        ) : (
          <Badge tone="warning">No key saved</Badge>
        )}
      </div>

      <form
        action={(fd) => {
          setTestResult(null);
          action(fd);
        }}
        className="space-y-3"
      >
        <div>
          <Label htmlFor="apiKey">{status.configured ? "Replace API key" : "API key"}</Label>
          <Input
            id="apiKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-..."
            disabled={disabled}
            required
          />
          <FieldHint>Stored encrypted on your server. It is never shown again or sent to the browser.</FieldHint>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled || pending}>
            <Save aria-hidden="true" />
            {pending ? "Saving..." : "Save key"}
          </Button>
          {status.configured && (
            <>
              <Button
                variant="secondary"
                disabled={testing}
                onClick={() => startTest(async () => setTestResult(await testConnectionAction()))}
              >
                <PlugZap aria-hidden="true" />
                {testing ? "Testing..." : "Test connection"}
              </Button>
              <Button
                variant="danger"
                disabled={removing}
                onClick={() => {
                  if (window.confirm("Remove the saved API key? AI features will stop until a new key is saved.")) {
                    startRemove(async () => {
                      setTestResult(null);
                      await removeApiKeyAction();
                    });
                  }
                }}
              >
                <Trash2 aria-hidden="true" />
                Remove
              </Button>
            </>
          )}
        </div>
      </form>

      {state.message && !testResult && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      {testResult?.message && <Alert tone={testResult.ok ? "success" : "error"}>{testResult.message}</Alert>}
    </div>
  );
}

export function ModelForm({
  current,
  models,
}: {
  current: string;
  models: { id: string; label: string; note: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveModelAction, {});
  const [selected, setSelected] = useState(current);
  const note = models.find((m) => m.id === selected)?.note;

  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="model">Model</Label>
        <Select id="model" name="model" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
        {note && <FieldHint>{note}</FieldHint>}
      </div>
      <Button type="submit" variant="secondary" disabled={pending || selected === current}>
        <Save aria-hidden="true" />
        {pending ? "Saving..." : "Save model"}
      </Button>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}
