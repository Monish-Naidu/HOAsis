"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRightLeft, LogOut, Trash2 } from "lucide-react";
import { Badge, Button, Callout, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { supabaseBrowser } from "@/lib/supabase/client";
import { loadRemote } from "@/lib/data/remote-store";
import { signOutOfSupabase } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * The ways out.
 *
 * Every one of these used to be either impossible or, worse, a single click
 * with no warning. Deleting yourself as the only officer worked silently and
 * left the association unreachable.
 *
 * The database refuses the dangerous ones now, so this screen's job is not to
 * prevent them. It is to explain what each one does before somebody picks, and
 * to make the genuinely destructive one deliberate enough that nobody reaches
 * it while aiming at something else.
 */

type Flow = null | "transfer" | "leave" | "cancel" | "delete";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand";

export function DangerZone() {
  const { community, account, isRemote } = useAppState();
  const { notify } = useToast();
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [successor, setSuccessor] = useState("");
  const [reason, setReason] = useState("");

  const isPresident = account?.role === "president";
  const others = community.accounts.filter((a) => a.id !== account?.id);
  const canceled = community.association.subscriptionStatus === "canceled";

  if (!isRemote) {
    return (
      <Card className="mt-5">
        <CardHeader title="Leaving" icon={<AlertTriangle className="size-4" />} />
        <div className="px-5 py-4">
          <p className="text-[15px] leading-relaxed text-fg-muted">
            This is a demo, so there is nothing to cancel and nothing to delete. Sign in to a
            real association to manage its subscription.
          </p>
        </div>
      </Card>
    );
  }

  async function run(
    label: string,
    fn: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) {
        notify(error.message, "warn");
        return false;
      }
      notify(label, "ok");
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "That did not work", "warn");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-5 border-danger/30">
      <CardHeader
        title="Leaving and closing"
        subtitle="Nothing here happens by accident, and only the last one destroys anything."
        icon={<AlertTriangle className="size-4" />}
      />

      <div className="divide-y divide-border">
        {/* Handing over. The only way a President can leave. */}
        {isPresident ? (
          <Row
            icon={<ArrowRightLeft className="size-4" />}
            title="Hand over the presidency"
            detail="Give the office to another household. You stay in the association as a resident, because you still own a home."
            action="Hand over"
            open={flow === "transfer"}
            onOpen={() => setFlow(flow === "transfer" ? null : "transfer")}
          >
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-fg">
                Who takes over
              </span>
              <select
                value={successor}
                onChange={(e) => setSuccessor(e.target.value)}
                className={inputClass}
              >
                <option value="">Choose a household</option>
                {others.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · Unit {a.unit}
                  </option>
                ))}
              </select>
            </label>
            {!others.length ? (
              <Callout tone="warn" title="There is nobody else yet">
                Invite another household and wait for them to sign up. Somebody has to be able
                to accept the office.
              </Callout>
            ) : null}
            <Button
              variant="primary"
              size="md"
              className="self-start"
              disabled={busy || !successor}
              onClick={async () => {
                const ok = await run("Presidency handed over", () =>
                  supabaseBrowser().rpc("transfer_presidency", { p_to_profile: successor }),
                );
                if (ok) {
                  await loadRemote(account?.id ?? null);
                  setFlow(null);
                  router.push("/resident");
                }
              }}
            >
              Hand over the presidency
            </Button>
          </Row>
        ) : null}

        {/* Leaving. Refused for a President, which the copy says up front. */}
        <Row
          icon={<LogOut className="size-4" />}
          title="Leave this association"
          detail={
            isPresident
              ? "You cannot leave while you hold the office. Hand it over first, then come back here."
              : "Removes your access. Your household stays on the register and your balance is unaffected, because the home is what owes money, not you."
          }
          action="Leave"
          disabled={isPresident}
          open={flow === "leave"}
          onOpen={() => setFlow(flow === "leave" ? null : "leave")}
        >
          <Callout tone="warn" title="You will lose access immediately">
            Somebody with the permissions capability can add you back, but you will not be able
            to do it yourself.
          </Callout>
          <Button
            variant="danger"
            size="md"
            className="self-start"
            disabled={busy}
            onClick={async () => {
              const ok = await run("You have left the association", () =>
                supabaseBrowser().rpc("leave_association", {
                  p_association_id: community.id,
                }),
              );
              if (ok) {
                await signOutOfSupabase();
                router.push("/signin");
              }
            }}
          >
            Leave {community.settings.displayName}
          </Button>
        </Row>

        {/* Billing. Deliberately not destructive. */}
        <Row
          icon={<AlertTriangle className="size-4" />}
          title={canceled ? "Restart the subscription" : "Cancel the subscription"}
          detail={
            canceled
              ? "Billing is stopped. Everything still works and every record is still here."
              : "Stops the bill at the end of the period. Nothing is deleted, everybody keeps their access, and you can export whatever you need."
          }
          action={canceled ? "Restart" : "Cancel"}
          open={flow === "cancel"}
          onOpen={() => setFlow(flow === "cancel" ? null : "cancel")}
        >
          {canceled ? (
            <Button
              variant="primary"
              size="md"
              className="self-start"
              disabled={busy}
              onClick={async () => {
                const ok = await run("Subscription restarted", () =>
                  supabaseBrowser().rpc("resume_subscription", {
                    p_association_id: community.id,
                  }),
                );
                if (ok) await loadRemote(account?.id ?? null);
              }}
            >
              Restart billing
            </Button>
          ) : (
            <>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-fg">
                  What made you cancel? Optional, and it goes to us rather than your board.
                </span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Too expensive, missing something, going back to a manager"
                  className={inputClass}
                />
              </label>
              <Callout tone="info" title="Your records stay put">
                Cancelling stops the bill. It does not delete anything, and it does not lock
                anybody out. Your books, documents and history remain exactly as they are.
              </Callout>
              <Button
                variant="secondary"
                size="md"
                className="self-start"
                disabled={busy}
                onClick={async () => {
                  const ok = await run("Subscription cancelled", () =>
                    supabaseBrowser().rpc("cancel_subscription", {
                      p_association_id: community.id,
                      p_reason: reason,
                    }),
                  );
                  if (ok) await loadRemote(account?.id ?? null);
                }}
              >
                Cancel the subscription
              </Button>
            </>
          )}
        </Row>

        {/* The only one that destroys anything. */}
        {isPresident ? (
          <Row
            icon={<Trash2 className="size-4" />}
            title="Delete this association"
            detail="Removes it for everybody. Recoverable for thirty days, then gone."
            action="Delete"
            tone="danger"
            open={flow === "delete"}
            onOpen={() => setFlow(flow === "delete" ? null : "delete")}
          >
            <Callout tone="danger" title="This affects every owner, not just you">
              Owners have payment records here that they are entitled to, and that your
              association is usually required to keep for years. Export anything you need
              first. You have thirty days to change your mind, after which it cannot be
              recovered.
            </Callout>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-fg">
                Type <span className="font-semibold">{community.settings.displayName}</span> to
                confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={community.settings.displayName}
                className={inputClass}
                autoComplete="off"
              />
            </label>
            <Button
              variant="danger"
              size="md"
              className="self-start"
              disabled={
                busy ||
                typed.trim().toLowerCase() !==
                  community.settings.displayName.trim().toLowerCase()
              }
              onClick={async () => {
                const ok = await run("Association scheduled for deletion", () =>
                  supabaseBrowser().rpc("request_association_deletion", {
                    p_association_id: community.id,
                    p_typed_name: typed,
                  }),
                );
                if (ok) {
                  await loadRemote(account?.id ?? null);
                  router.push("/signin");
                }
              }}
            >
              Delete {community.settings.displayName}
            </Button>
          </Row>
        ) : null}
      </div>
    </Card>
  );
}

function Row({
  icon,
  title,
  detail,
  action,
  open,
  onOpen,
  disabled,
  tone = "neutral",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: string;
  open: boolean;
  onOpen: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
              tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-2 text-fg-muted",
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-fg">{title}</p>
            <p className="mt-0.5 max-w-xl text-[13px] leading-relaxed text-fg-muted">
              {detail}
            </p>
          </div>
        </div>
        {disabled ? (
          <Badge tone="neutral">Not available</Badge>
        ) : (
          <Button variant={tone === "danger" ? "danger" : "secondary"} size="sm" onClick={onOpen}>
            {open ? "Close" : action}
          </Button>
        )}
      </div>

      {/* Opens in place rather than in a dialog, so the explanation stays
          visible next to the thing it is explaining. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 pl-11">{children}</div>
        </div>
      </div>
    </div>
  );
}
