import React, { useState } from "react";
import { Search, SearchX, PackageSearch, Plus } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Button, Select, EmptyState, Loading } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { ItemCard } from "../../components/ItemBits.jsx";
import { ITEM_CATEGORIES } from "../../lib/helpers.js";

export default function LostFoundBrowse() {
  const { items, dataLoading } = useApp();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [category, setCategory] = useState("All");

  const types = ["All", "Lost", "Found"];
  const filtered = items
    .filter((i) => type === "All" || i.type === type)
    .filter((i) => category === "All" || i.category === category)
    .filter((i) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return i.title.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q) || (i.location ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <AppShell activeKey="lost-found" title="Lost & Found">
      <PageHeader
        title="Lost & Found"
        subtitle="Browse items reported lost or found around campus."
        action={<Button icon={Plus} onClick={() => navigate("/lost-found/new")}>Post an Item</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FilterTabs options={types} value={type} onChange={setType} />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-44">
            <option value="All">All categories</option>
            {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      {dataLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState icon={PackageSearch} title="Nothing here yet" message="Be the first to post a lost or found item." action={<Button icon={Plus} onClick={() => navigate("/lost-found/new")}>Post an Item</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching items" message="Try a different search or filter." action={<Button variant="secondary" onClick={() => { setQuery(""); setType("All"); setCategory("All"); }}>Clear filters</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((i) => (
            <ItemCard key={i.id} item={i} onOpen={() => navigate(`/lost-found/${i.id}`)} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
