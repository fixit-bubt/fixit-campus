import React, { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ItemForm } from "./ItemForm.jsx";

export default function EditItem({ id }) {
  const { currentUser, items, dataLoading, updateItem } = useApp();
  const toast = useToast();
  const item = items.find((i) => i.id === id);

  useEffect(() => {
    if (dataLoading) return; // wait for store to hydrate before redirecting
    if (!item) {
      navigate("/lost-found");
      return;
    }
    if (!currentUser || item.posterId !== currentUser.id) navigate(`/lost-found/${id}`);
  }, [item, id, currentUser, dataLoading]);

  if (dataLoading) return null;
  if (!item || !currentUser || item.posterId !== currentUser.id) return null;

  async function handleSubmit(form) {
    const res = await updateItem(id, form);
    if (!res.ok) {
      toast({ type: "error", title: "Couldn't save item", message: res.error });
      return;
    }
    toast({ type: "success", title: "Item updated" });
    navigate(`/lost-found/${id}`);
  }

  return (
    <AppShell activeKey="lost-found" title="Edit Item">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(`/lost-found/${id}`)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back to item
        </button>
        <PageHeader title="Edit Item" subtitle={`Editing ${item.id}.`} />
        <ItemForm
          mode="edit"
          initial={{ type: item.type, title: item.title, category: item.category, description: item.description, location: item.location, date: item.date, photo: item.photo }}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/lost-found/${id}`)}
        />
      </div>
    </AppShell>
  );
}
