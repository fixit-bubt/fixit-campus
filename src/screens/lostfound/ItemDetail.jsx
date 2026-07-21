import React, { useState, useEffect } from "react";
import {
  ArrowLeft, MapPin, Calendar, Pencil, Trash2, Lock, CircleCheck, CircleX,
  Clock, Hand, PackageCheck, PackageX, Send, Check, X, Inbox, Mail, MessageCircle,
} from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Card, Button, Field, Textarea, FileUpload, Modal, Avatar, Badge, EmptyState, StatusBadge, Spinner, Loading, useToast } from "../../components/ui.jsx";
import { AppShell } from "../../components/AppShell.jsx";
import { ItemPhoto, ItemTypeBadge } from "../../components/ItemBits.jsx";
import { ITEM_CATEGORY_ICON, fmtDate, findItemMatches } from "../../lib/helpers.js";
import { waHref, mailHref } from "../../components/featureKit.jsx";

function ClaimModal({ open, item, onClose, onSubmitted }) {
  const { addClaim } = useApp();
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState("form"); // form | done

  useEffect(() => {
    if (open) {
      setMessage("");
      setProof(null);
      setProofFile(null);
      setError("");
      setSubmitting(false);
      setStep("form");
    }
  }, [open]);

  if (!open || !item) return null;
  const isFound = item.type === "Found";
  const kind = isFound ? "claim" : "notify";

  async function submit() {
    if (submitting) return;
    if (message.trim().length < 10) {
      setError("Add a few details so the poster can confirm it's yours.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await addClaim({ itemUuid: item.uuid, kind, message, proof, proofFile });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStep("done");
      onSubmitted && onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <Modal
        open={open}
        onClose={onClose}
        icon={CircleCheck}
        tone="emerald"
        title="Submitted — waiting for the poster"
        description="The person who posted this item will review your request. If they approve it, you'll both see each other's contact details."
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
          ? "Tell the poster why this item is yours. The more specific your proof, the easier it is for them to confirm."
          : "Let the owner know you've found their item. Add anything that confirms it's the same one."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button icon={Send} onClick={submit} disabled={submitting}>
            {submitting ? <Spinner size={16} className="border-white/40 border-t-white" /> : isFound ? "Submit claim" : "Notify owner"}
          </Button>
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
        <Field label="Photo proof" htmlFor="claim-proof" hint="Optional — a photo can help the poster confirm.">
          <FileUpload
            id="claim-proof"
            value={proof}
            onChange={(url, file) => { setProof(url); setProofFile(file); }}
          />
        </Field>
      </div>
    </Modal>
  );
}

function ContactCard({ user, label }) {
  const wa = waHref(user.whatsapp);
  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5 text-base font-semibold text-success">
        <CircleCheck size={16} /> Contact unlocked
      </div>
      <p className="mt-1 text-xs text-ink-3">{label}</p>
      <div className="mt-3 space-y-2.5 rounded-md border border-brd bg-surface-2 p-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} src={user.avatar} />
          <p className="truncate text-base font-semibold text-ink">{user.name}</p>
        </div>
        <a href={mailHref(user.email) || `mailto:${user.email}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-xs text-brand hover:text-brand-700">
          <Mail size={13} className="shrink-0" /> <span className="truncate">{user.email}</span>
        </a>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-1.5 text-xs text-success hover:text-success"
          >
            <MessageCircle size={13} className="shrink-0" /> <span className="truncate">{user.whatsapp}</span>
          </a>
        )}
      </div>
    </Card>
  );
}

// One incoming claim, shown to the poster with Approve / Reject.
function PosterClaimRow({ claim, claimant, onDecide, busy, proofUrl, itemResolved }) {
  return (
    <div className="border-t border-brd pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar name={claimant?.name || "?"} size={26} />
          <div>
            <p className="text-base font-semibold text-ink">{claimant?.name || "Unknown"}</p>
            <p className="text-xs text-ink-3">{fmtDate(claim.createdAt)}</p>
          </div>
        </div>
        {claim.status !== "Pending" && <StatusBadge status={claim.status} />}
      </div>
      <p className="mt-3 rounded-md bg-surface-2 p-3 text-base leading-relaxed text-ink-2">{claim.message}</p>
      {claim.proof && proofUrl && <img src={proofUrl} alt="proof" className="mt-3 max-h-40 rounded-md border border-brd object-cover" />}
      {claim.status === "Pending" && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {itemResolved && <span className="mr-auto text-xs text-ink-3">Item already resolved</span>}
          <Button size="sm" variant="secondary" icon={X} className="text-danger" disabled={busy} onClick={() => onDecide(claim, "Rejected")}>Reject</Button>
          {!itemResolved && <Button size="sm" icon={Check} disabled={busy} onClick={() => onDecide(claim, "Approved")}>Approve</Button>}
        </div>
      )}
    </div>
  );
}

// Lost & Found item detail (students only). The POSTER approves/rejects claims;
// contact between the two students unlocks once a claim is approved.
export default function ItemDetail({ id }) {
  const { currentUser, items, claims, userById, deleteItem, setClaimStatus, getContact, getProofUrl, dataLoading } = useApp();
  const toast = useToast();
  const item = items.find((i) => i.id === id);
  const [claimOpen, setClaimOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [contact, setContact] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyClaim, setBusyClaim] = useState(null); // id of the claim being decided
  const [proofUrls, setProofUrls] = useState({}); // claim id -> short-lived signed proof URL

  // Reveal the counterpart's contact once a claim is approved (either side).
  useEffect(() => {
    let active = true;
    if (!item) { setContact(null); return; }
    const approvedClaim = claims.find((c) => c.itemId === item.id && c.status === "Approved");
    let targetId = null;
    if (approvedClaim) {
      if (item.posterId === currentUser?.id) targetId = approvedClaim.claimantId;
      else if (approvedClaim.claimantId === currentUser?.id) targetId = item.posterId;
    }
    if (targetId) getContact(targetId).then((c) => { if (active) setContact(c); });
    else setContact(null);
    return () => { active = false; };
  }, [item?.id, claims, currentUser?.id]);

  // Poster only: resolve each claim's private proof path to a signed view URL.
  useEffect(() => {
    let active = true;
    if (!item || item.posterId !== currentUser?.id) { setProofUrls({}); return; }
    const withProof = claims.filter((c) => c.itemId === item.id && c.proof);
    if (!withProof.length) { setProofUrls({}); return; }
    Promise.all(withProof.map((c) => getProofUrl(c.proof).then((url) => [c.id, url]))).then((pairs) => {
      if (active) setProofUrls(Object.fromEntries(pairs));
    });
    return () => { active = false; };
  }, [item?.id, claims, currentUser?.id]);

  if (!item) {
    return (
      <AppShell activeKey="lost-found" title="Item">
        {dataLoading ? <Loading /> : <EmptyState icon={PackageX} title="Item not found" message="This item may have been removed." action={<Button onClick={() => navigate("/lost-found")}>Back to Lost &amp; Found</Button>} />}
      </AppShell>
    );
  }

  const poster = userById(item.posterId);
  const isPoster = item.posterId === currentUser?.id;
  // Active claim gates the button; a Rejected claim doesn't — the DB's partial
  // unique index (0026) deliberately allows a rejected claimant to re-submit.
  const myClaims = claims.filter((c) => c.itemId === item.id && c.claimantId === currentUser?.id);
  const myClaim = myClaims.find((c) => c.status !== "Rejected");
  const myRejectedClaim = myClaim ? null : myClaims.find((c) => c.status === "Rejected");
  const itemClaims = isPoster
    ? claims
        .filter((c) => c.itemId === item.id)
        .sort(
          (a, b) =>
            (a.status === "Pending" ? 0 : 1) - (b.status === "Pending" ? 0 : 1) ||
            b.createdAt.localeCompare(a.createdAt)
        )
    : [];
  const isFound = item.type === "Found";
  const CategoryIcon = ITEM_CATEGORY_ICON[item.category];
  const revealLabel = isPoster
    ? "Shared with you after you approved the claim."
    : "Shared with you after the poster approved your claim.";

  const ClaimStatusIcon = myClaim
    ? myClaim.status === "Approved" ? CircleCheck : myClaim.status === "Rejected" ? CircleX : Clock
    : myRejectedClaim ? CircleX : Clock;

  async function doDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await deleteItem(id);
      if (res.ok) { toast({ type: "success", title: "Item removed" }); navigate("/lost-found"); return; }
      toast({ type: "error", title: "Couldn't remove", message: res.error });
    } finally {
      setDeleting(false);
    }
  }

  async function decide(claim, status) {
    if (busyClaim) return;
    setBusyClaim(claim.id);
    try {
      const res = await setClaimStatus(claim.id, status);
      if (res.ok) {
        toast({
          type: "success",
          title: status === "Approved" ? "Claim approved" : "Claim rejected",
          message: status === "Approved" ? "Contact details are now shared between you both." : "The claimant will see it wasn't approved.",
        });
      } else {
        toast({ type: "error", title: "Couldn't update claim", message: res.error });
      }
    } finally {
      setBusyClaim(null);
    }
  }

  return (
    <AppShell activeKey="lost-found" title="Item Detail">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate("/lost-found")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
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
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-ink">{item.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-base text-ink-3">
              <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-ink-3" />{item.location}</span>
              <span className="inline-flex items-center gap-1.5"><Calendar size={15} className="text-ink-3" />{fmtDate(item.date)}</span>
            </div>

            <p className="mt-4 text-base leading-relaxed text-ink-2">{item.description}</p>

            <div className="mt-5 flex items-center gap-2 border-t border-brd pt-4 text-base text-ink-3">
              <Avatar name={poster?.name || "?"} size={26} />
              Posted by {isPoster ? "you" : poster?.name || "Unknown"}
            </div>

            {/* Actions */}
            <div className="mt-5">
              {isPoster ? (
                <div className="flex gap-2">
                  <Button variant="secondary" icon={Pencil} onClick={() => navigate(`/lost-found/${id}/edit`)}>Edit</Button>
                  <Button variant="secondary" icon={Trash2} className="text-danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
                </div>
              ) : myClaim ? (
                <div className="flex items-center gap-3 rounded-md border border-brd bg-surface-2 px-4 py-3">
                  <ClaimStatusIcon
                    size={18}
                    className={myClaim.status === "Approved" ? "text-success" : myClaim.status === "Rejected" ? "text-danger" : "text-warn"}
                  />
                  <div className="text-base">
                    <p className="font-semibold text-ink">
                      {myClaim.status === "Pending"
                        ? "Submitted — waiting for the poster"
                        : myClaim.status === "Approved"
                        ? "Approved — contact shared below"
                        : "Not approved"}
                    </p>
                    <p className="text-xs text-ink-3">Your {myClaim.kind === "claim" ? "claim" : "notification"} · {fmtDate(myClaim.createdAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {myRejectedClaim && (
                    <div className="flex items-center gap-3 rounded-md border border-brd bg-surface-2 px-4 py-3">
                      <ClaimStatusIcon size={18} className="text-danger" />
                      <div className="text-base">
                        <p className="font-semibold text-ink">Not approved</p>
                        <p className="text-xs text-ink-3">Your earlier {myRejectedClaim.kind === "claim" ? "claim" : "notification"} wasn't approved — you can submit a new one with better details.</p>
                      </div>
                    </div>
                  )}
                  <Button icon={isFound ? Hand : PackageCheck} onClick={() => setClaimOpen(true)}>
                    {isFound ? "This is mine — Claim" : "I found this — Notify owner"}
                  </Button>
                </div>
              )}
            </div>

            {/* Contact */}
            <div className="mt-5">
              {contact ? (
                <ContactCard user={contact} label={revealLabel} />
              ) : (
                <div className="flex items-center gap-3 rounded-md border border-dashed border-brd-2 bg-surface-2 px-4 py-3 text-base text-ink-3">
                  <Lock size={16} className="text-ink-3" />
                  Contact details are hidden until the poster approves a claim.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Poster: possible matches from the other side of the board */}
        {isPoster && item.status === "Open" && (() => {
          const matches = findItemMatches(item, items, { excludePosterId: currentUser?.id });
          if (matches.length === 0) return null;
          return (
            <Card className="mt-6 p-6">
              <h3 className="text-base font-semibold text-ink">
                Possible matches — {item.type === "Lost" ? "recently found items" : "people looking for something like this"}
              </h3>
              <p className="mt-1 text-base text-ink-3">Same category, similar words. Take a look — your item might already be on the board.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {matches.map(({ item: m }) => (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/lost-found/${m.id}`)}
                    className="flex items-center gap-3 rounded-md border border-brd bg-surface px-3 py-2.5 text-left hover:bg-surface-2"
                  >
                    <ItemTypeBadge type={m.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-ink">{m.title}</span>
                      <span className="block truncate text-xs text-ink-3">{m.location} · {fmtDate(m.date)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          );
        })()}

        {/* Poster: incoming claims to approve / reject */}
        {isPoster && (
          <Card className="mt-6 p-6">
            <h3 className="text-base font-semibold text-ink">Claims on this item</h3>
            <p className="mt-1 text-base text-ink-3">Approve a claim to share contact details with that person.</p>
            <div className="mt-4 space-y-4">
              {itemClaims.length === 0 ? (
                <EmptyState icon={Inbox} title="No claims yet" message="When someone claims this item, it'll appear here for you to review." />
              ) : (
                itemClaims.map((c) => (
                  <PosterClaimRow key={c.id} claim={c} claimant={userById(c.claimantId)} onDecide={decide} busy={busyClaim === c.id} proofUrl={proofUrls[c.id]} itemResolved={item.status === "Resolved"} />
                ))
              )}
            </div>
          </Card>
        )}
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
        description={`"${item.title}" will be removed from the board. Claims already submitted are kept for record-keeping.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete} disabled={deleting}>Delete item</Button>
          </>
        }
      />
    </AppShell>
  );
}
