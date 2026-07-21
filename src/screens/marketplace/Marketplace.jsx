import React from "react";
import { Icon } from "../../components/Icon.jsx";
import {
  Button, Card, Badge, StatusBadge, Field, Input, Textarea, Select, FileUpload,
  EmptyState, Modal, Avatar, Spinner, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import {
  AccentTile, CountdownBanner, SegmentToggle,
  taka, fmtTime, fmtCountdown, nextDeparture, toMinutes, minutesToHHMM,
  nowDhakaMinutes, dhakaParts, useTick, waHref,
} from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { fmtDate, relativeDate, todayISO } from "../../lib/helpers.js";

// ============================================================================
// FEATURE 4 — Marketplace  (signature accent: violet)
// Mirrors the Lost & Found layout. Browse + detail + post form + my listings.
// ============================================================================

export const MKT_CATEGORIES = ["Books", "Electronics", "Furniture", "Notes", "Other"];
export const MKT_CATEGORY_ICON = { Books: "BookOpen", Electronics: "Smartphone", Furniture: "Armchair", Notes: "NotebookPen", Other: "Package" };
export const CONDITION_TONE = { New: "emerald", "Like New": "blue", Used: "slate" };

export function MktPhoto({ listing, className = "" }) {
  if (listing.photo) return <img src={listing.photo} alt={listing.title} className={`object-cover ${className}`} />;
  const PlaceholderIcon = MKT_CATEGORY_ICON[listing.category] || "Package";
  return (
    <div className={`flex items-center justify-center bg-surface-3 text-ink-3 ${className}`}>
      <Icon name={PlaceholderIcon} size={40} strokeWidth={1.5} />
    </div>
  );
}

// --- Listing card -----------------------------------------------------------
export function ListingCard({ listing, seller, onOpen }) {
  const sold = listing.status === "Sold";
  return (
    <button onClick={onOpen} className="group flex flex-col overflow-hidden rounded-md border border-brd bg-surface text-left shadow-sm transition-all hover:border-brd-2 hover:shadow-md">
      <div className="relative h-40 w-full overflow-hidden">
        <MktPhoto listing={listing} className={`h-full w-full transition-transform group-hover:scale-105 ${sold ? "opacity-60" : ""}`} />
        <div className="absolute left-3 top-3"><Badge tone="violet" icon={MKT_CATEGORY_ICON[listing.category]}>{listing.category}</Badge></div>
        {sold && <div className="absolute right-3 top-3"><Badge tone="slate">Sold</Badge></div>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-semibold text-ink">{listing.title}</h3>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xl font-bold text-ink">{taka(listing.price)}</span>
          {listing.negotiable && <Badge tone="violet">Negotiable</Badge>}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone={CONDITION_TONE[listing.condition]}>{listing.condition}</Badge>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-brd pt-3 text-xs text-ink-3">
          <Avatar name={seller?.name || "?"} size={20} />
          <span className="truncate">{seller?.name || "Unknown"}</span>
        </div>
      </div>
    </button>
  );
}

// --- Browse -----------------------------------------------------------------
export function Marketplace() {
  const { currentUser, listings, userById, dataLoading } = useApp();
  const isAdmin = currentUser?.role === "Admin";
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("All");
  const [status, setStatus] = React.useState("All");
  const [sortBy, setSortBy] = React.useState("newest"); // newest | price-asc | price-desc
  const [minPrice, setMinPrice] = React.useState("");
  const [maxPrice, setMaxPrice] = React.useState("");

  const statuses = ["All", "Available", "Sold"];
  const min = parseInt(minPrice, 10);
  const max = parseInt(maxPrice, 10);
  const filtered = listings
    .filter((l) => status === "All" || l.status === status)
    .filter((l) => category === "All" || l.category === category)
    .filter((l) => (Number.isNaN(min) || l.price >= min) && (Number.isNaN(max) || l.price <= max))
    .filter((l) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (l.title || "").toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

  return (
    <AppShell activeKey="marketplace" title="Marketplace">
      <PageHeader title="Marketplace" subtitle={isAdmin ? "Browse and moderate campus listings." : "Buy and sell with fellow students on campus."}
        action={isAdmin ? null : (
          <div className="flex gap-2">
            <Button variant="secondary" icon="Tag" onClick={() => navigate("/marketplace/mine")}>My Listings</Button>
            <Button icon="Plus" onClick={() => navigate("/marketplace/new")}>Post an Item</Button>
          </div>
        )} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Icon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search listings" placeholder="Search listings…"
            className="h-10 w-full rounded-md border border-brd bg-surface pl-9 pr-3 text-base placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-100" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FilterTabs options={statuses} value={status} onChange={setStatus} />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-44">
            <option value="All">All categories</option>
            {MKT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      {/* Price tools */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-44" aria-label="Sort listings">
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </Select>
        <div className="flex items-center gap-1.5">
          <input
            value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric" aria-label="Minimum price" placeholder="Min ৳"
            className="h-10 w-24 rounded-md border border-brd bg-surface px-3 text-base placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
          <span className="text-ink-3">–</span>
          <input
            value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric" aria-label="Maximum price" placeholder="Max ৳"
            className="h-10 w-24 rounded-md border border-brd bg-surface px-3 text-base placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
        </div>
        {(minPrice || maxPrice || sortBy !== "newest") && (
          <button
            onClick={() => { setMinPrice(""); setMaxPrice(""); setSortBy("newest"); }}
            className="text-sm font-semibold text-brand hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {dataLoading ? (
        <Loading />
      ) : listings.length === 0 ? (
        <EmptyState icon="Store" title="Nothing for sale yet" message="Be the first to list an item — use “Post an Item” at the top." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="SearchX" title="No matching listings" message="Try a different search or filter." action={<Button variant="secondary" onClick={() => { setQuery(""); setCategory("All"); setStatus("All"); setMinPrice(""); setMaxPrice(""); setSortBy("newest"); }}>Clear filters</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((l) => <ListingCard key={l.id} listing={l} seller={userById(l.sellerId)} onOpen={() => navigate(`/marketplace/${l.id}`)} />)}
        </div>
      )}
    </AppShell>
  );
}

// Seller contact — fetched on click. Shows WhatsApp only if the seller opted in
// (the listing_contact RPC returns a null number otherwise).
function SellerContact({ code, sellerName }) {
  const { getListingContact } = useApp();
  const toast = useToast();
  const [phase, setPhase] = React.useState("idle"); // idle | loading | done
  const [contact, setContact] = React.useState(null);

  async function reveal() {
    setPhase("loading");
    const res = await getListingContact(code);
    if (res?.error) {
      // RPC/network failure — keep the button so the buyer can retry.
      toast({ type: "error", title: "Couldn't get contact", message: res.error });
      setPhase("idle");
      return;
    }
    setContact(res);
    setPhase("done");
  }

  if (phase !== "done") {
    return (
      <button onClick={reveal} disabled={phase === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-success-bg bg-success-bg px-4 py-2.5 text-base font-semibold text-success transition-colors hover:bg-success-bg disabled:opacity-60">
        <Icon name="MessageCircle" size={16} /> {phase === "loading" ? "Getting contact…" : "Contact on WhatsApp"}
      </button>
    );
  }

  const wa = waHref(contact?.whatsapp);
  return (
    <div className="rounded-md border border-success-bg bg-success-bg p-4">
      <div className="flex items-center gap-1.5 text-base font-semibold text-success">
        <Icon name="CircleCheck" size={16} /> {contact?.name || sellerName || "Seller"}
      </div>
      {wa ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-brd bg-surface p-3">
          <p className="truncate text-base text-ink-2">{contact.whatsapp}</p>
          <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-success px-3 text-base font-semibold text-white hover:brightness-95">
            <Icon name="MessageCircle" size={16} /> WhatsApp
          </a>
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-3">This seller hasn't shared a WhatsApp number. They can enable it in their profile.</p>
      )}
    </div>
  );
}

// --- Detail -----------------------------------------------------------------
export function ListingDetail({ id }) {
  const { currentUser, listings, userById, markListingSold, deleteListing, dataLoading } = useApp();
  const toast = useToast();
  const listing = listings.find((l) => l.id === id);
  const [confirmSold, setConfirmSold] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [actionBusy, setActionBusy] = React.useState(false);

  if (!listing) {
    return (
      <AppShell activeKey="marketplace" title="Listing">
        {dataLoading ? <Loading /> : <EmptyState icon="PackageX" title="Listing not found" message="This item may have been removed." action={<Button onClick={() => navigate("/marketplace")}>Back to Marketplace</Button>} />}
      </AppShell>
    );
  }
  const seller = userById(listing.sellerId);
  const isOwner = !!currentUser && listing.sellerId === currentUser.id;
  const isAdmin = currentUser?.role === "Admin";
  const canModerate = isOwner || isAdmin;
  const sold = listing.status === "Sold";

  return (
    <AppShell activeKey="marketplace" title="Listing">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate("/marketplace")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
          <Icon name="ArrowLeft" size={16} /> Back to Marketplace
        </button>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <MktPhoto listing={listing} className="h-64 w-full lg:h-72" />
            </Card>
          </div>

          <div className="lg:col-span-3">
            <div className="flex items-center gap-2">
              <Badge tone="violet" icon={MKT_CATEGORY_ICON[listing.category]}>{listing.category}</Badge>
              <Badge tone={CONDITION_TONE[listing.condition]}>{listing.condition}</Badge>
              {listing.courseCode && <Badge tone="sky">{listing.courseCode}</Badge>}
              {sold && <Badge tone="slate">Sold</Badge>}
            </div>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-ink">{listing.title}</h2>
            <div className="mt-2 flex items-center gap-2.5">
              <span className="text-4xl font-bold text-ink">{taka(listing.price)}</span>
              {listing.negotiable && <Badge tone="violet">Negotiable</Badge>}
            </div>
            <p className="mt-4 text-base leading-relaxed text-ink-2">{listing.description}</p>

            <div className="mt-5 flex items-center gap-2 border-t border-brd pt-4 text-base text-ink-3">
              <Avatar name={seller?.name || "?"} size={26} /> Listed by {isOwner ? "you" : seller?.name || "Unknown"} · {fmtDate(listing.createdAt)}
            </div>

            <div className="mt-5">
              {canModerate ? (
                <div className="flex flex-wrap gap-2">
                  {!sold && <Button variant="secondary" icon="BadgeCheck" onClick={() => setConfirmSold(true)}>Mark as Sold</Button>}
                  {isOwner && <Button variant="secondary" icon="Pencil" onClick={() => navigate(`/marketplace/${id}/edit`)}>Edit</Button>}
                  <Button variant="secondary" icon="Trash2" className="text-danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
                </div>
              ) : sold ? (
                <div className="flex items-center gap-2 rounded-md border border-brd bg-surface-2 px-4 py-3 text-base text-ink-3">
                  <Icon name="BadgeCheck" size={16} className="text-ink-3" /> This item has been sold.
                </div>
              ) : (
                <SellerContact code={id} sellerName={seller?.name} />
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={confirmSold} onClose={() => !actionBusy && setConfirmSold(false)} icon="BadgeCheck" tone="emerald"
        title="Mark as sold?" description={`"${listing.title}" will be shown as Sold and removed from active listings.`}
        footer={<><Button variant="secondary" disabled={actionBusy} onClick={() => setConfirmSold(false)}>Cancel</Button>
          <Button disabled={actionBusy} onClick={async () => { if (actionBusy) return; setActionBusy(true); try { const r = await markListingSold(id); setConfirmSold(false); if (!r.ok) { toast({ type: "error", title: "Couldn't update", message: r.error }); return; } toast({ type: "success", title: "Marked as sold" }); } finally { setActionBusy(false); } }}>Mark as Sold</Button></>} />

      <Modal open={confirmDelete} onClose={() => !actionBusy && setConfirmDelete(false)} icon="Trash2" tone="red"
        title="Delete this listing?" description={`"${listing.title}" will be permanently removed.`}
        footer={<><Button variant="secondary" disabled={actionBusy} onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="destructive" disabled={actionBusy} onClick={async () => { if (actionBusy) return; setActionBusy(true); try { const r = await deleteListing(id); if (!r.ok) { toast({ type: "error", title: "Couldn't delete", message: r.error }); return; } toast({ type: "success", title: "Listing deleted" }); navigate("/marketplace"); } finally { setActionBusy(false); } }}>Delete</Button></>} />
    </AppShell>
  );
}

// --- Post / Edit form -------------------------------------------------------
// Wrapper: wait for the listing to load (so a deep-link/refresh of the edit
// route never seeds a blank form that Save would write back), and redirect a
// non-owner before the editor mounts.
export function ListingForm({ id }) {
  const { currentUser, listings, dataLoading } = useApp();
  const editing = !!id;
  const existing = editing ? listings.find((l) => l.id === id) : null;
  const isAdmin = currentUser?.role === "Admin";
  const denied = (editing && existing && existing.sellerId !== currentUser?.id) || (!editing && isAdmin);

  React.useEffect(() => {
    if (denied) navigate(editing ? `/marketplace/${id}` : "/marketplace");
  }, [denied, id, editing]);

  if (editing && (dataLoading || !existing)) {
    return (
      <AppShell activeKey="marketplace" title="Edit Listing">
        {dataLoading ? <Loading /> : <EmptyState icon="PackageX" title="Listing not found" message="This item may have been removed." action={<Button onClick={() => navigate("/marketplace")}>Back to Marketplace</Button>} />}
      </AppShell>
    );
  }
  if (denied) return null;
  return <ListingEditor id={id} existing={existing} />;
}

function ListingEditor({ id, existing }) {
  const { addListing, updateListing } = useApp();
  const toast = useToast();
  const editing = !!id;

  const [form, setForm] = React.useState(
    existing
      ? { title: existing.title, price: String(existing.price), category: existing.category, condition: existing.condition, negotiable: existing.negotiable, description: existing.description, photo: existing.photo, photoFile: null, courseCode: existing.courseCode || "" }
      : { title: "", price: "", category: "", condition: "", negotiable: false, description: "", photo: null, photoFile: null, courseCode: "" }
  );
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const er = {};
    if (!form.title.trim()) er.title = "Give your item a title.";
    else if (form.title.trim().length < 2) er.title = "Title must be at least 2 characters."; // DB check: char_length(title) >= 2
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) er.price = "Enter a valid price.";
    else if (Number(form.price) > 100000000) er.price = "Enter a realistic price."; // keep well under the int4 column limit
    if (!form.category) er.category = "Choose a category.";
    if (!form.condition) er.condition = "Select the condition.";
    if (!form.description.trim()) er.description = "Add a description.";
    return er;
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const data = { title: form.title.trim(), price: Number(form.price), category: form.category, condition: form.condition, negotiable: form.negotiable, description: form.description.trim(), photo: form.photo, photoFile: form.photoFile, courseCode: form.courseCode };
      const res = editing ? await updateListing(id, data) : await addListing(data);
      if (!res.ok) { toast({ type: "error", title: editing ? "Couldn't update listing" : "Couldn't post listing", message: res.error }); return; }
      if (editing) { toast({ type: "success", title: "Listing updated" }); navigate(`/marketplace/${id}`); }
      else { toast({ type: "success", title: "Listing posted", message: "It's now live." }); navigate(`/marketplace/${res.id}`); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activeKey="marketplace" title={editing ? "Edit Listing" : "Post an Item"}>
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(editing ? `/marketplace/${id}` : "/marketplace")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
          <Icon name="ArrowLeft" size={16} /> Back
        </button>
        <PageHeader title={editing ? "Edit Listing" : "Post an Item"} subtitle="Sell something to fellow students." />
        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-5 p-6">
            <Field label="Photo" htmlFor="lf-photo" hint="A clear photo helps your item sell faster.">
              <FileUpload id="lf-photo" value={form.photo} onChange={(url, file) => setForm((f) => ({ ...f, photo: url, photoFile: file }))} />
            </Field>
            <Field label="Title" htmlFor="lf-title" required error={errors.title}>
              <Input id="lf-title" placeholder="e.g. Casio fx-991EX calculator" value={form.title} error={!!errors.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Price (৳)" htmlFor="lf-price" required error={errors.price}>
                <Input id="lf-price" type="number" min="0" placeholder="e.g. 1200" value={form.price} error={!!errors.price} onChange={(e) => set("price", e.target.value)} />
              </Field>
              <Field label="Category" htmlFor="lf-cat" required error={errors.category}>
                <Select id="lf-cat" value={form.category} error={!!errors.category} onChange={(e) => set("category", e.target.value)}>
                  <option value="">Select a category</option>
                  {MKT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            {["Books", "Notes"].includes(form.category) && (
              <Field label="Course code" htmlFor="lf-course" hint="Optional — links this listing to the course's Study Hub page (e.g. CSE 101).">
                <Input id="lf-course" placeholder="e.g. CSE 101" value={form.courseCode} onChange={(e) => set("courseCode", e.target.value)} />
              </Field>
            )}
            <Field label="Condition" htmlFor="lf-cond" required error={errors.condition}>
              <div className="flex flex-wrap gap-2">
                {["New", "Like New", "Used"].map((c) => {
                  const active = form.condition === c;
                  return (
                    <button type="button" key={c} onClick={() => set("condition", c)}
                      className={`rounded-md border px-3 py-2 text-base font-semibold transition-colors ${active ? "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300" : "border-brd bg-surface text-ink-2 hover:bg-surface-2"}`}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </Field>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-brd px-4 py-3">
              <input type="checkbox" checked={form.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="h-4 w-4 rounded border-brd-2 text-violet-600 dark:text-violet-300 focus:ring-violet-500" />
              <span className="text-base text-ink-2">Price is negotiable</span>
            </label>
            <Field label="Description" htmlFor="lf-desc" required error={errors.description}>
              <Textarea id="lf-desc" rows={4} placeholder="Describe the item — condition, age, reason for selling…" value={form.description} error={!!errors.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-ink-3">
              <Icon name="Lock" size={14} className="shrink-0 text-ink-3" /> Buyers contact you on WhatsApp — your number is shown only when they choose to reach out.
            </div>
          </Card>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/marketplace")}>Cancel</Button>
            <Button type="submit" icon={editing ? "Check" : "Plus"} disabled={saving}>
              {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : editing ? "Save changes" : "Post item"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

// --- My Listings ------------------------------------------------------------
export function MyListings() {
  const { currentUser, listings, userById, dataLoading } = useApp();
  React.useEffect(() => { if (currentUser?.role === "Admin") navigate("/marketplace"); }, [currentUser?.role]);
  const mine = listings.filter((l) => l.sellerId === currentUser?.id).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return (
    <AppShell activeKey="marketplace" title="My Listings">
      <PageHeader title="My Listings" subtitle="Items you're selling."
        action={<Button icon="Plus" onClick={() => navigate("/marketplace/new")}>Post an Item</Button>} />
      {dataLoading ? (
        <Loading />
      ) : mine.length === 0 ? (
        <EmptyState icon="Tag" title="No listings yet" message="Post an item to start selling." action={<Button icon="Plus" onClick={() => navigate("/marketplace/new")}>Post an Item</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mine.map((l) => <ListingCard key={l.id} listing={l} seller={userById(l.sellerId)} onOpen={() => navigate(`/marketplace/${l.id}`)} />)}
        </div>
      )}
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function MarketplaceWidget() {
  const { listings } = useApp();
  const available = listings.filter((l) => l.status === "Available").length;
  return (
    <button onClick={() => navigate("/marketplace")} className="group flex w-full items-center gap-4 rounded-md border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-violet-300 dark:hover:border-violet-500/40 hover:bg-violet-50/40 dark:hover:bg-violet-500/10">
      <AccentTile icon="Store" tone="violet" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">Marketplace</p>
        <p className="truncate text-xs text-ink-3">{available} item{available === 1 ? "" : "s"} for sale right now</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-ink-3 group-hover:text-violet-500 dark:group-hover:text-violet-300" />
    </button>
  );
}
