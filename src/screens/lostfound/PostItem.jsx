import React from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ItemForm } from "./ItemForm.jsx";

export default function PostItem() {
  const { currentUser, addItem } = useApp();
  const toast = useToast();

  function handleSubmit(form) {
    const item = addItem({
      type: form.type,
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      location: form.location.trim(),
      date: form.date,
      photo: form.photo,
      posterId: currentUser.id,
    });
    toast({ type: "success", title: "Item posted", message: `"${item.title}" is now on the board.` });
    navigate(`/lost-found/${item.id}`);
  }

  return (
    <AppShell activeKey="lost-found" title="Post an Item">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate("/lost-found")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back to Lost &amp; Found
        </button>
        <PageHeader title="Post an Item" subtitle="Report something you've lost or found on campus." />
        <ItemForm mode="create" onSubmit={handleSubmit} onCancel={() => navigate("/lost-found")} />
      </div>
    </AppShell>
  );
}
