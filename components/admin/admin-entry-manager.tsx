"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

type MaterialKind = "PDF" | "ZIP";

type MaterialRow = {
  id: string;
  kind: MaterialKind;
  title: string;
  googleDriveFileId: string;
  mimeType: string;
};

type CatalogItem = {
  id: string;
  videoId: string;
  classCode: string;
  classTitle: string;
  classDate: string | null;
  classPrice: number | null;
  googleDriveFileId: string;
  mimeType: string | null;
  materials: Array<{
    assetId: string;
    title: string;
    kind: "PDF" | "ZIP";
    googleDriveFileId: string;
    mimeType: string | null;
    sizeBytes: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

function newMaterial(kind: MaterialKind): MaterialRow {
  return {
    id: crypto.randomUUID(),
    kind,
    title: "",
    googleDriveFileId: "",
    mimeType: kind === "PDF" ? "application/pdf" : "application/zip",
  };
}

export function AdminEntryManager() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState("");
  const [classCode, setClassCode] = useState("");
  const [classTitle, setClassTitle] = useState("");
  const [classDate, setClassDate] = useState("");
  const [classPrice, setClassPrice] = useState("");
  const [recordingTitle, setRecordingTitle] = useState("");
  const [recordingDriveId, setRecordingDriveId] = useState("");
  const [recordingMimeType, setRecordingMimeType] = useState("video/mp4");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);

  async function loadCatalog() {
    const response = await fetch("/api/admin/entries");
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as { items: CatalogItem[] };
    setItems(data.items);
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        videoId,
        classCode,
        classTitle,
        classDate: classDate || undefined,
        classPrice: classPrice ? Number(classPrice) : undefined,
        recording: {
          title: recordingTitle || classTitle,
          kind: "VIDEO",
          googleDriveFileId: recordingDriveId,
          mimeType: recordingMimeType || "video/mp4",
        },
        materials: materials.map((material) => ({
          title: material.title,
          kind: material.kind,
          googleDriveFileId: material.googleDriveFileId,
          mimeType: material.mimeType,
        })),
      };

      const response = await fetch("/api/admin/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; message?: string; videoId?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save catalog entry.");
      }

      setMessage(`Catalog entry saved for videoId: ${data.videoId}`);
      await loadCatalog();
      setSelectedVideoId(videoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save catalog entry.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedVideoId(null);
    setVideoId("");
    setClassCode("");
    setClassTitle("");
    setClassDate("");
    setClassPrice("");
    setRecordingTitle("");
    setRecordingDriveId("");
    setRecordingMimeType("video/mp4");
    setMaterials([]);
    setMessage(null);
    setError(null);
  }

  function editItem(item: CatalogItem) {
    setSelectedVideoId(item.videoId);
    setVideoId(item.videoId);
    setClassCode(item.classCode);
    setClassTitle(item.classTitle);
    setClassDate(item.classDate ?? "");
    setClassPrice(item.classPrice != null ? String(item.classPrice) : "");
    setRecordingTitle(item.classTitle);
    setRecordingDriveId(item.googleDriveFileId);
    setRecordingMimeType(item.mimeType ?? "video/mp4");
    setMaterials(
      item.materials.map((material) => ({
        id: crypto.randomUUID(),
        kind: material.kind,
        title: material.title,
        googleDriveFileId: material.googleDriveFileId,
        mimeType: material.mimeType ?? (material.kind === "PDF" ? "application/pdf" : "application/zip"),
      })),
    );
    setMessage(`Editing ${item.videoId}. You can now add more materials and save.`);
    setError(null);
  }

  function removeMaterial(materialId: string) {
    setMaterials((prev) => prev.filter((material) => material.id !== materialId));
  }

  return (
    <div className="space-y-6">
      <form className="card space-y-4" onSubmit={submit}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">
            {selectedVideoId ? `Update Recording: ${selectedVideoId}` : "Create Video Catalog Entry"}
          </h2>
          {selectedVideoId ? (
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-xs text-[#00194c] hover:border-[#f39c12]"
              onClick={resetForm}
              type="button"
            >
              <RefreshCw size={14} />
              New entry
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="field"
            placeholder="Video ID (unique, e.g. CF1-2026)"
            required
            value={videoId}
            onChange={(event) => setVideoId(event.target.value)}
          />
          <input
            className="field"
            placeholder="Class code (CF1)"
            required
            value={classCode}
            onChange={(event) => setClassCode(event.target.value)}
          />
          <input
            className="field"
            placeholder="Class title"
            required
            value={classTitle}
            onChange={(event) => setClassTitle(event.target.value)}
          />
          <input
            className="field"
            placeholder="Class date (optional)"
            value={classDate}
            onChange={(event) => setClassDate(event.target.value)}
          />
          <input
            className="field"
            min={0}
            placeholder="Price (optional)"
            step="0.01"
            type="number"
            value={classPrice}
            onChange={(event) => setClassPrice(event.target.value)}
          />
          <input
            className="field"
            placeholder="Recording title (optional)"
            value={recordingTitle}
            onChange={(event) => setRecordingTitle(event.target.value)}
          />
          <input
            className="field md:col-span-2"
            placeholder="Recording Google Drive file ID"
            required
            value={recordingDriveId}
            onChange={(event) => setRecordingDriveId(event.target.value)}
          />
          <input
            className="field"
            placeholder="Recording MIME type"
            value={recordingMimeType}
            onChange={(event) => setRecordingMimeType(event.target.value)}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm text-[#4a5f93]">
            Materials (PDF/ZIP). {selectedVideoId ? "Add new material rows, then save to append/update this recording." : ""}
          </p>
          {materials.map((material, index) => (
            <div className="grid gap-2 rounded-xl border border-[#d8e1f5] bg-white p-3 md:grid-cols-6" key={material.id}>
              <select
                className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-[#00194c]"
                value={material.kind}
                onChange={(event) => {
                  const next = [...materials];
                  next[index] = { ...next[index], kind: event.target.value as MaterialKind };
                  setMaterials(next);
                }}
              >
                <option value="PDF">PDF</option>
                <option value="ZIP">ZIP</option>
              </select>
              <input
                className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-[#00194c] md:col-span-2"
                placeholder="Material title"
                required
                value={material.title}
                onChange={(event) => {
                  const next = [...materials];
                  next[index] = { ...next[index], title: event.target.value };
                  setMaterials(next);
                }}
              />
              <input
                className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-[#00194c] md:col-span-2"
                placeholder="Material Google Drive file ID"
                required
                value={material.googleDriveFileId}
                onChange={(event) => {
                  const next = [...materials];
                  next[index] = { ...next[index], googleDriveFileId: event.target.value };
                  setMaterials(next);
                }}
              />
              <button
                className="inline-flex items-center justify-center rounded-lg border border-[#ffd6d6] bg-[#fff6f6] px-3 py-2 text-[#a33] hover:border-[#ffb3b3]"
                onClick={() => removeMaterial(material.id)}
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-sm text-[#00194c] hover:border-[#f39c12]"
              onClick={() => setMaterials((prev) => [...prev, newMaterial("PDF")])}
              type="button"
            >
              <Plus size={14} />
              Add material
            </button>
            <button
              className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-sm text-[#00194c] hover:border-[#f39c12] disabled:opacity-50"
              disabled={materials.length === 0}
              onClick={() => setMaterials((prev) => prev.slice(0, -1))}
              type="button"
            >
              Remove last
            </button>
          </div>
        </div>

        <button className="btn-primary" disabled={loading} type="submit">
          {loading ? "Saving..." : selectedVideoId ? "Save changes" : "Save catalog entry"}
        </button>
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      <section className="card">
        <h2 className="text-xl font-semibold">Catalog Entries</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[#6a7dab]">
              <tr>
                <th className="px-2 py-2">Video ID</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Price</th>
                <th className="px-2 py-2">Materials</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-t border-[#e3eaf8]" key={item.id}>
                  <td className="px-2 py-2">{item.videoId}</td>
                  <td className="px-2 py-2">{item.classCode} - {item.classTitle}</td>
                  <td className="px-2 py-2">{item.classDate ?? "-"}</td>
                  <td className="px-2 py-2">{item.classPrice ?? "-"}</td>
                  <td className="px-2 py-2">{item.materials.length}</td>
                  <td className="px-2 py-2">
                    <button
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d8e1f5] bg-white px-2 py-1 text-xs text-[#12316a] hover:border-[#f39c12]"
                      onClick={() => editItem(item)}
                      type="button"
                    >
                      <Pencil size={12} />
                      Edit/Add materials
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

