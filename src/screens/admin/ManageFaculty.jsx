import React, { useState, useMemo, useRef } from "react";
import { useApp } from "../../data/store.jsx";
import {
  Card, Button, Modal, Field, Input, Avatar, EmptyState, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Icon } from "../../components/Icon.jsx";

const shortDept = (name = "") => name.replace(/^Department of\s+/i, "");

function LinkedInBadge({ url }) {
  if (url) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
        <Icon name="Linkedin" size={11} /> Linked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">
      <Icon name="Linkedin" size={11} /> Missing
    </span>
  );
}

function EditModal({ faculty: f, deptName, onClose, onSave, onUploadPhoto }) {
  const [linkedin, setLinkedin] = useState(f.links.linkedin || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(f.photo || null);
  const [photoFile, setPhotoFile] = useState(null);
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
  }

  async function handleSave() {
    const trimmedLinkedin = linkedin.trim();
    if (trimmedLinkedin && !trimmedLinkedin.startsWith("http")) {
      toast({ type: "error", title: "Invalid URL", message: "LinkedIn URL must start with https://" });
      return;
    }

    setSaving(true);

    // Upload photo first if a new file was chosen
    if (photoFile) {
      setUploading(true);
      const upResult = await onUploadPhoto(f.id, photoFile);
      setUploading(false);
      if (!upResult.ok) {
        toast({ type: "error", title: "Photo upload failed", message: upResult.error });
        setSaving(false);
        return;
      }
    }

    const result = await onSave(f.id, { linkedin_url: trimmedLinkedin || null });
    setSaving(false);
    if (result.ok) {
      toast({ type: "success", title: "Saved", message: `${f.name}'s profile updated.` });
      onClose();
    } else {
      toast({ type: "error", title: "Failed to save", message: result.error });
    }
  }

  return (
    <Modal title="Edit Faculty Profile" onClose={onClose}>
      <div className="mb-5 flex items-center gap-3">
        <Avatar name={f.name} src={photoPreview} size={44} />
        <div>
          <p className="text-sm font-semibold text-slate-900">{f.name}</p>
          <p className="text-xs text-slate-500">{f.designation}{deptName ? ` · ${deptName}` : ""}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Photo upload */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Profile Photo</p>
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="h-20 w-20 rounded-full object-cover border-2 border-slate-200"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 border-2 border-dashed border-slate-300">
                  <Icon name="UserRound" size={28} className="text-slate-400" />
                </div>
              )}
              {photoPreview && (
                <button
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-red-600"
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
              <p className="text-xs text-slate-400">JPG, PNG, WebP · max 5 MB</p>
            </div>
          </div>
        </div>

        {/* LinkedIn URL */}
        <Field label="LinkedIn Profile URL">
          <Input
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://www.linkedin.com/in/username"
            type="url"
          />
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>
          {uploading ? "Uploading…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}

export default function ManageFaculty() {
  const { faculty, departments, updateFaculty, uploadFacultyPhoto, dataLoading } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | missing | linked
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
        if (filter === "missing") return !f.links.linkedin;
        if (filter === "linked") return !!f.links.linkedin;
        return true;
      })
      .filter((f) => {
        if (!q) return true;
        const dept = deptMap[f.departmentId];
        return (
          f.name.toLowerCase().includes(q) ||
          f.designation.toLowerCase().includes(q) ||
          (dept && dept.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [faculty, filter, query, deptMap]);

  const linkedCount = faculty.filter((f) => f.links.linkedin).length;
  const missingCount = faculty.length - linkedCount;

  const FILTERS = [
    { key: "all", label: `All (${faculty.length})` },
    { key: "missing", label: `Missing LinkedIn (${missingCount})` },
    { key: "linked", label: `Has LinkedIn (${linkedCount})` },
  ];

  if (dataLoading && faculty.length === 0) {
    return (
      <AppShell activeKey="faculty-admin" title="Faculty Profiles">
        <PageHeader title="Faculty Profiles" subtitle="Manage LinkedIn links and photos for all teachers." />
        <Loading />
      </AppShell>
    );
  }

  return (
    <AppShell activeKey="faculty-admin" title="Faculty Profiles">
      <PageHeader
        title="Faculty Profiles"
        subtitle={`${linkedCount} of ${faculty.length} teachers have a LinkedIn link.`}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <Icon name="Search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, designation, or department…"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
        />
      </div>

      {/* Count */}
      <p className="mt-3 text-xs text-slate-500">{list.length} teacher{list.length === 1 ? "" : "s"}</p>

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
                    <p className="text-sm font-semibold text-slate-900 truncate">{f.name}</p>
                    <LinkedInBadge url={f.links.linkedin} />
                    {!f.photo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                        <Icon name="ImageOff" size={11} /> No photo
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">
                    {f.designation}{dept ? ` · ${shortDept(dept.name)}` : ""}
                  </p>
                  {f.links.linkedin && (
                    <a
                      href={f.links.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-xs text-blue-600 hover:underline"
                    >
                      {f.links.linkedin}
                    </a>
                  )}
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
