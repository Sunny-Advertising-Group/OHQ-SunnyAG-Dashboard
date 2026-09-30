"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/admin/actions";

/**
 * A form bound to a server action, with an inline "Saved" / error message.
 * `confirm` asks before submitting (used for deletes). `resetOnSuccess` clears add-forms.
 */
export function ActionForm({
  action,
  children,
  className,
  style,
  confirm,
  resetOnSuccess,
  submit,
  submitClass = "btn sm",
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  confirm?: string;
  resetOnSuccess?: boolean;
  submit?: string;
  submitClass?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      className={className}
      style={style}
      onSubmit={(e) => {
        // Submit via a transition rather than <form action>, so React doesn't
        // clear the fields when a save fails.
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {children}
      {submit && (
        <div className="row full" style={{ gap: 10 }}>
          <button className={submitClass} type="submit" disabled={pending}>
            {pending ? "Saving…" : submit}
          </button>
          <Status state={state} />
        </div>
      )}
      {!submit && <Status state={state} />}
    </form>
  );
}

function Status({ state }: { state: ActionState }) {
  if (state?.error)
    return (
      <span className="err-msg" role="alert">
        {state.error}
      </span>
    );
  if (state?.ok)
    return (
      <span className="ok-msg" role="status">
        {state.ok}
      </span>
    );
  return null;
}

/** A single delete/remove button with its own confirm. */
export function DeleteButton({
  action,
  id,
  label = "Remove",
  confirm,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  id: string;
  label?: string;
  confirm: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn danger sm" type="submit" disabled={pending}>
        {pending ? "…" : label}
      </button>
      {state?.error && <span className="err-msg"> {state.error}</span>}
    </form>
  );
}
