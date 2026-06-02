import React, { useState, useEffect } from "react";
import {
  ArrowLeft, MapPin, Calendar, Pencil, Trash2, Lock, CircleCheck, CircleX,
  Clock, Hand, PackageCheck, PackageX, Send,
} from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Card, Button, Field, Textarea, FileUpload, Modal, Avatar, Badge, EmptyState, useToast } from "../../components/ui.jsx";
import { AppShell } from "../../components/AppShell.jsx";
import { ItemPhoto, ItemTypeBadge } from "../../components/ItemBits.jsx";
import { ITEM_CATEGORY_ICON, fmtDate } from "../../lib/helpers.js";

function ClaimModal({ open, item, onClose, onSubmitted }) {
  const { currentUser, addClaim } = useApp();
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState("form"); // form | done

  useEffect(() => {
    if (open) {
      setMessage("");
      setProof(null);
      setError("");
      setStep("form");
    }
  }, [open]);

  if (!open || !item) return null;
  const isFound = item.type === "Found";
  const kind = isFound ? "claim" : "notify";

  function submit() {
    if (message.trim().length < 10) {
      setError("Add a few details so the admin can verify your claim.");
      return;
    }
    addClaim({ itemId: item.id, claimantId: currentUser.id, kind, message: message.trim(), proof });
    setStep("done");
    onSubmitted && onSubmitted();
  }

  if (step === "done") {
    return (
      <Modal
        open={open}
        onClose={onClose}
        icon={CircleCheck}
        tone="emerald"
        title="Submitted — pending verification"
        description="An admin will review your submission. If it's approved, contact details will be shared between you and the other party."
        footer={<Button onClick={onClose}>Done</Button>}
      />
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={isFound ? Hand : PackageCheck}
      tone="blue"
      size="lg"
      title={isFound ? "Claim this item" : "Notify the owner"}
      description={
        isFound
          ? "Tell us why this item is yours. The more specific your proof, the faster an admin can verify it."
          : "Let the owner know you've found their item. Add anything that confirms it's the same one."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon={Send} onClick={submit}>{isFound ? "Submit claim" : "Notify owner"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={isFound ? "Proof of ownership" : "Message"} htmlFor="claim-msg" required error={error}>
          <Textarea
            id="claim-msg"
            rows={4}
            placeholder={
              isFound
                ? "e.g. They're black Ray-Ban frames with a chip on the left arm and a blue cloth in the case."
                : "e.g. I found these near the library entrance this morning — happy to hand them in."
            }
            value={message}
            error={!!error}
            onChange={(e) => { setMessage(e.target.value); setError(""); }}
          />
        </Field>
        <Field label="Photo proof" htmlFor="claim-proof" hint="Optional — a photo can speed up verification.">
          <FileUpload id="claim-proof" value={proof} onChange={(url) => setProof(url)} />
        </Field>
      </div>
    </Modal>
  );
}

function ContactCard({ user, label }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
        <CircleCheck size={16} /> Contact unlocked
      </div>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Avatar name={user.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <a href={`mailto:${user.email}`} className="truncate text-xs text-blue-600 hover:text-blue-700">{user.email}</a>
        </div>
      </div>
    </Card>
  );
}

// Shared item detail. Poster sees Edit/Delete; others see Claim/Notify.
// Contact is locked until an admin approves a claim.
export default function ItemDetail({ id }) {
  const { currentUser, items, claims, userById, deleteItem } = useApp();
  const toast = useToast();
  const item = items.find((i) => i.id === id);
  const [claimOpen, setClaimOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!item) {
    return (
      <AppShell activeKey="lost-found" title="Item">
        <EmptyState icon={PackageX} title="Item not found" message="This item may have been removed." action={<Button onClick={() => navigate("/lost-found")}>Back to Lost &amp; Found</Button>} />
      </AppShell>
    );
  }

  const poster = userById(item.posterId);
  const isPoster = item.posterId === currentUser.id;
  const myClaim = claims.find((c) => c.itemId === item.id && c.claimantId === currentUser.id);
  const approved = claims.find((c) => c.itemId === item.id && c.status === "Approved");
  const isFound = item.type === "Found";
  const CategoryIcon = ITEM_CATEGORY_ICON[item.category];

  // contact reveal
  let revealUser = null;
  let revealLabel = "";
  if (approved) {
    if (isPoster) {
      revealUser = userById(approved.claimantId);
      revealLabel = "Shared with you after the claim was approved.";
    } else if (approved.claimantId === currentUser.id) {
      revealUser = poster;
      revealLabel = "Shared with you after your claim was approved.";
    }
  }

  const ClaimStatusIcon = myClaim
    ? myClaim.status === "Approved" ? CircleCheck : myClaim.status === "Rejected" ? CircleX : Clock
    : Clock;

  function doDelete() {
    deleteItem(id);
    toast({ type: "success", title: "Item removed" });
    navigate("/lost-found");
  }

  return (
    <AppShell activeKey="lost-found" title="Item Detail">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate("/lost-found")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back to Lost &amp; Found
        </button>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Photo */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <ItemPhoto item={item} className="h-64 w-full lg:h-72" />
            </Card>
          </div>

          {/* Details */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2">
              <ItemTypeBadge type={item.type} />
              <Badge tone="neutral" icon={CategoryIcon}>{item.category}</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{item.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-slate-400" />{item.location}</span>
              <span className="inline-flex items-center gap-1.5"><Calendar size={15} className="text-slate-400" />{fmtDate(item.date)}</span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-700">{item.description}</p>

            <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
              <Avatar name={poster?.name || "?"} size={26} />
              Posted by {isPoster ? "you" : poster?.name || "Unknown"}
            </div>

            {/* Actions */}
            <div className="mt-5">
              {isPoster ? (
                <div className="flex gap-2">
                  <Button variant="secondary" icon={Pencil} onClick={() => navigate(`/lost-found/${id}/edit`)}>Edit</Button>
                  <Button variant="secondary" icon={Trash2} className="text-red-600" onClick={() => setConfirmDelete(true)}>Delete</Button>
                </div>
              ) : myClaim ? (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <ClaimStatusIcon
                    size={18}
                    className={myClaim.status === "Approved" ? "text-emerald-600" : myClaim.status === "Rejected" ? "text-red-600" : "text-amber-600"}
                  />
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">
                      {myClaim.status === "Pending"
                        ? "Submitted — pending verification"
                        : myClaim.status === "Approved"
                        ? "Approved — contact shared below"
                        : "Not approved"}
                    </p>
                    <p className="text-xs text-slate-500">Your {myClaim.kind === "claim" ? "claim" : "notification"} · {fmtDate(myClaim.createdAt)}</p>
                  </div>
                </div>
              ) : (
                <Button icon={isFound ? Hand : PackageCheck} onClick={() => setClaimOpen(true)}>
                  {isFound ? "This is mine — Claim" : "I found this — Notify owner"}
                </Button>
              )}
            </div>

            {/* Contact */}
            <div className="mt-5">
              {revealUser ? (
                <ContactCard user={revealUser} label={revealLabel} />
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <Lock size={16} className="text-slate-400" />
                  Contact details are hidden until an admin approves a claim.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ClaimModal
        open={claimOpen}
        item={item}
        onClose={() => setClaimOpen(false)}
        onSubmitted={() => toast({ type: "success", title: isFound ? "Claim submitted" : "Owner notified" })}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        icon={Trash2}
        tone="red"
        title="Delete this item?"
        description={`"${item.title}" and any claims on it will be permanently removed.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>Delete item</Button>
          </>
        }
      />
    </AppShell>
  );
}
