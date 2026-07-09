import React from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ItemForm } from "./ItemForm.jsx";

export default function PostItem() {
  const { addItem } = useApp();
  const toast = useToast();

  async function handleSubmit(form) {
    const res = await addItem(form);
    if (!res.ok) {
      toast({ type: "error", title: "Couldn't post item", message: res.error });
      return;
    }
    toast({ type: "success", title: "Item posted", message: `"${form.title.trim()}" is now on the board.` });
    navigate(`/lost-found/${res.id}`);
  }

  return (
    <AppShell activeKey="lost-found" title="Post an Item">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate("/lost-found")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
          <ArrowLeft size={16} /> Back to Lost &amp; Found
        </button>
        <PageHeader title="Post an Item" subtitle="Report something you've lost or found on campus." />
        <ItemForm mode="create" onSubmit={handleSubmit} onCancel={() => navigate("/lost-found")} />
      </div>
    </AppShell>
  );
}
