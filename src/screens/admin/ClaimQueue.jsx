import React, { useState } from "react";
import { X, Check, ShieldCheck, ShieldX, Inbox } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { Card, Button, Modal, Avatar, StatusBadge, EmptyState, useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { ItemPhoto, ItemTypeBadge } from "../../components/ItemBits.jsx";
import { fmtDate } from "../../lib/helpers.js";

function ClaimCard({ claim, item, claimant, onAction }) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Item */}
        <div className="flex items-start gap-3 sm:w-64 sm:shrink-0">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200">
            {item ? <ItemPhoto item={item} className="h-full w-full" /> : <div className="h-full w-full bg-slate-100" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {item && <ItemTypeBadge type={item.type} />}
            </div>
            <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-900">{item?.title || "Removed item"}</p>
            <p className="font-mono text-xs text-slate-400">{claim.itemId}</p>
          </div>
        </div>

        {/* Claim body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar name={claimant?.name || "?"} size={26} />
              <div>
                <p className="text-sm font-medium text-slate-900">{claimant?.name || "Unknown"}</p>
                <p className="text-xs text-slate-400">
                  {claim.kind === "claim" ? "Claims ownership" : "Reports finding it"} · {fmtDate(claim.createdAt)}
                </p>
              </div>
            </div>
            {claim.status !== "Pending" && <StatusBadge status={claim.status} />}
          </div>

          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{claim.message}</p>

          {claim.proof && <img src={claim.proof} alt="proof" className="mt-3 max-h-40 rounded-lg border border-slate-200 object-cover" />}

          {claim.status === "Pending" && (
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" icon={X} className="text-red-600" onClick={() => onAction(claim, "reject")}>Reject</Button>
              <Button size="sm" icon={Check} onClick={() => onAction(claim, "approve")}>Approve</Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ClaimQueue() {
  const { claims, items, userById, setClaimStatus } = useApp();
  const toast = useToast();
  const [filter, setFilter] = useState("Pending");
  const [confirm, setConfirm] = useState(null); // { claim, action }

  const statuses = ["Pending", "Approved", "Rejected"];
  const counts = statuses.reduce((acc, s) => {
    acc[s] = claims.filter((c) => c.status === s).length;
    return acc;
  }, {});
  const filtered = claims.filter((c) => c.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function doConfirm() {
    const { claim, action } = confirm;
    const newStatus = action === "approve" ? "Approved" : "Rejected";
    setClaimStatus(claim.id, newStatus);
    toast({
      type: "success",
      title: action === "approve" ? "Claim approved" : "Claim rejected",
      message: action === "approve" ? "Contact details are now shared between both parties." : "The claimant will see this was not approved.",
    });
    setConfirm(null);
  }

  return (
    <AppShell activeKey="claims" title="Lost & Found Claims">
      <PageHeader title="Claim verification" subtitle="Review claims and notifications, then approve or reject them." />

      <div className="mb-5">
        <FilterTabs options={statuses} value={filter} onChange={setFilter} counts={counts} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={filter === "Pending" ? ShieldCheck : Inbox}
          title={filter === "Pending" ? "No claims to review" : `No ${filter.toLowerCase()} claims`}
          message={filter === "Pending" ? "New claims and notifications will appear here for verification." : "Nothing here yet."}
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((c) => (
            <ClaimCard key={c.id} claim={c} item={items.find((i) => i.id === c.itemId)} claimant={userById(c.claimantId)} onAction={(claim, action) => setConfirm({ claim, action })} />
          ))}
        </div>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        icon={confirm?.action === "approve" ? ShieldCheck : ShieldX}
        tone={confirm?.action === "approve" ? "emerald" : "red"}
        title={confirm?.action === "approve" ? "Approve this claim?" : "Reject this claim?"}
        description={
          confirm?.action === "approve"
            ? "Approving shares contact details between the claimant and the item's poster so they can connect."
            : "The claimant will be told their submission wasn't approved. They can't be undone easily, so double-check the proof."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.action === "approve" ? "primary" : "destructive"} onClick={doConfirm}>
              {confirm?.action === "approve" ? "Approve & share contact" : "Reject claim"}
            </Button>
          </>
        }
      />
    </AppShell>
  );
}
