import React, { useState, useMemo, useRef } from "react";
import { useApp } from "../../data/store.jsx";
import {
  Card, Button, Modal, Field, Input, Avatar, EmptyState, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Icon } from "../../components/Icon.jsx";

const shortDept = (name = "") => name.replace(/^Department of\s+/i, "");

function EditModal({ faculty: f, deptName, onClose, onSave, onUploadPhoto }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(f.photo || null);
  const [photoFile, setPhotoFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ type: "error", title: "Invalid file", message: "Please choose an image file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ type: "error", title: "File too large", message: "Photo must be under 5 MB." });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Upload photo first if a new file was chosen
      if (photoFile) {
        setUploading(true);
        const upResult = await onUploadPhoto(f.id, photoFile);
        setUploading(false);
        if (!upResult.ok) {
          toast({ type: "error", title: "Photo upload failed", message: upResult.error });
          return;
        }
      }

      const updates = {};
      if (removePhoto && !photoFile) updates.photo_url = null;
      const result = await onSave(f.id, updates);
      if (result.ok) {
        toast({ type: "success", title: "Saved", message: `${f.name}'s profile updated.` });
        onClose();
      } else {
        toast({ type: "error", title: "Failed to save", message: result.error });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Faculty Profile">
      <div className="mb-5 flex items-center gap-3">
        <Avatar name={f.name} src={photoPreview} size={44} />
        <div>
          <p className="text-base font-semibold text-ink">{f.name}</p>
          <p className="text-xs text-ink-3">{f.designation}{deptName ? ` · ${deptName}` : ""}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Photo upload */}
        <div>
          <p className="mb-2 text-base font-semibold text-ink-2">Profile Photo</p>
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="h-20 w-20 rounded-full object-cover border-2 border-brd"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-3 border-2 border-dashed border-brd-2">
                  <Icon name="UserRound" size={28} className="text-ink-3" />
                </div>
              )}
              {photoPreview && (
                <button
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); setRemovePhoto(!!f.photo); }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-danger"
                  title="Remove photo"
                >
                  <Icon name="X" size={11} />
                </button>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                size="sm"
                variant="secondary"
                icon="Upload"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {photoPreview ? "Change photo" : "Upload photo"}
              </Button>
              <p className="text-xs text-ink-3">JPG, PNG, WebP · max 5 MB</p>
            </div>
          </div>
        </div>

      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {uploading ? "Uploading…" : saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}

export default function ManageFaculty() {
  const { faculty, departments, updateFaculty, uploadFacultyPhoto, dataLoading } = useApp();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);

  const deptMap = useMemo(() => {
    const m = {};
    departments.forEach((d) => { m[d.id] = d; });
    return m;
  }, [departments]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faculty
      .filter((f) => {
        if (!q) return true;
        const dept = deptMap[f.departmentId];
        return (
          (f.name ?? "").toLowerCase().includes(q) ||
          (f.designation ?? "").toLowerCase().includes(q) ||
          (dept && (dept.name ?? "").toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [faculty, query, deptMap]);

  if (dataLoading && faculty.length === 0) {
    return (
      <AppShell activeKey="faculty-admin" title="Faculty Profiles">
        <PageHeader title="Faculty Profiles" subtitle="Manage photos for all teachers." />
        <Loading />
      </AppShell>
    );
  }

  return (
    <AppShell activeKey="faculty-admin" title="Faculty Profiles">
      <PageHeader
        title="Faculty Profiles"
        subtitle={`${faculty.length} teacher${faculty.length === 1 ? "" : "s"} · manage photos.`}
      />

      {/* Search */}
      <div className="relative mt-4">
        <Icon name="Search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search faculty"
          placeholder="Search by name, designation, or department…"
          className="h-11 w-full rounded-md border border-brd bg-surface pl-10 pr-4 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {/* Count */}
      <p className="mt-3 text-xs text-ink-3">{list.length} teacher{list.length === 1 ? "" : "s"}</p>

      {list.length === 0 ? (
        <EmptyState icon="SearchX" title="No teachers found" message="Try a different search or filter." />
      ) : (
        <div className="mt-2 space-y-2">
          {list.map((f) => {
            const dept = deptMap[f.departmentId];
            return (
              <Card key={f.id} className="flex items-center gap-4 px-4 py-3">
                <Avatar name={f.name} src={f.photo} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold text-ink truncate">{f.name}</p>
                    {!f.photo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn">
                        <Icon name="ImageOff" size={11} /> No photo
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3 truncate">
                    {f.designation}{dept ? ` · ${shortDept(dept.name)}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="Pencil"
                  onClick={() => setEditing(f)}
                >
                  Edit
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <EditModal
          faculty={editing}
          deptName={deptMap[editing.departmentId] ? shortDept(deptMap[editing.departmentId].name) : ""}
          onClose={() => setEditing(null)}
          onSave={updateFaculty}
          onUploadPhoto={uploadFacultyPhoto}
        />
      )}
    </AppShell>
  );
}
