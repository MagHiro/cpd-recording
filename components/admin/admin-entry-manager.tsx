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
  sourceMode: "url" | "browse";
  driveInput: string;
  resolvedName: string | null;
  viewLink: string | null;
  isFetched: boolean;
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
    sourceMode: "url",
    driveInput: "",
    resolvedName: null,
    viewLink: null,
    isFetched: false,
  };
}

type DriveFileResult = {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes?: number;
  webViewLink?: string;
};

type PickerTarget = { kind: "recording" } | { kind: "material"; materialId: string };

function driveViewLinkFromId(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

export function AdminEntryManager() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState("");
  const [classCode, setClassCode] = useState("");
  const [classTitle, setClassTitle] = useState("");
  const [classDate, setClassDate] = useState("");
  const [recordingTitle, setRecordingTitle] = useState("");
  const [recordingDriveInput, setRecordingDriveInput] = useState("");
  const [recordingDriveFileId, setRecordingDriveFileId] = useState("");
  const [recordingResolvedName, setRecordingResolvedName] = useState<string | null>(null);
  const [recordingViewLink, setRecordingViewLink] = useState<string | null>(null);
  const [recordingFetched, setRecordingFetched] = useState(false);
  const [recordingSourceMode, setRecordingSourceMode] = useState<"url" | "browse">("url");
  const [recordingMimeType, setRecordingMimeType] = useState("video/mp4");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingRecording, setFetchingRecording] = useState(false);
  const [fetchingMaterialId, setFetchingMaterialId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [driveQuery, setDriveQuery] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFileResult[]>([]);
  const [driveNextPageToken, setDriveNextPageToken] = useState<string | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const hasUnfetchedRecording =
    recordingSourceMode === "url" && recordingDriveInput.trim().length > 0 && !recordingFetched;
  const hasUnfetchedMaterials = materials.some(
    (material) => material.sourceMode === "url" && material.driveInput.trim().length > 0 && !material.isFetched,
  );

  async function fetchDriveFile(input: string) {
    const response = await fetch(`/api/admin/google/drive-file?input=${encodeURIComponent(input)}`, { method: "GET" });
    const data = (await response.json()) as {
      error?: string;
      id?: string;
      title?: string;
      mimeType?: string;
      webViewLink?: string;
    };
    if (!response.ok || !data.id) {
      throw new Error(data.error ?? "Failed to fetch Google Drive file metadata.");
    }
    return data;
  }

  async function listDriveFiles(query: string, pageToken?: string | null) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (pageToken) params.set("pageToken", pageToken);
    params.set("pageSize", "20");

    const response = await fetch(`/api/admin/google/drive-files?${params.toString()}`, { method: "GET" });
    const data = (await response.json()) as {
      error?: string;
      files?: DriveFileResult[];
      nextPageToken?: string | null;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to list Google Drive files.");
    }
    return {
      files: data.files ?? [],
      nextPageToken: data.nextPageToken ?? null,
    };
  }

  function validateSourcesBeforeSave(): string | null {
    if (recordingSourceMode === "url" && !recordingFetched) {
      return "Fetch recording URL/ID before saving.";
    }
    if (!recordingDriveFileId) {
      return "Select a recording file before saving.";
    }
    for (const material of materials) {
      if (material.sourceMode === "url" && !material.isFetched) {
        return `Fetch URL/ID for material \"${material.title || "untitled"}\" before saving.`;
      }
      if (!material.googleDriveFileId) {
        return `Select a file for material \"${material.title || "untitled"}\" before saving.`;
      }
    }
    return null;
  }

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
      const sourceError = validateSourcesBeforeSave();
      if (sourceError) {
        throw new Error(sourceError);
      }

      const payload = {
        videoId,
        classCode,
        classTitle,
        classDate: classDate || undefined,
        recording: {
          title: recordingTitle || classTitle,
          kind: "VIDEO",
          googleDriveFileId: recordingDriveFileId,
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
    setRecordingTitle("");
    setRecordingDriveInput("");
    setRecordingDriveFileId("");
    setRecordingResolvedName(null);
    setRecordingViewLink(null);
    setRecordingFetched(false);
    setRecordingSourceMode("url");
    setRecordingMimeType("video/mp4");
    setMaterials([]);
    setMessage(null);
    setError(null);
    setPickerTarget(null);
    setDriveFiles([]);
    setDriveNextPageToken(null);
    setDriveError(null);
  }

  function editItem(item: CatalogItem) {
    setSelectedVideoId(item.videoId);
    setVideoId(item.videoId);
    setClassCode(item.classCode);
    setClassTitle(item.classTitle);
    setClassDate(item.classDate ?? "");
    setRecordingTitle(item.classTitle);
    setRecordingDriveInput(item.googleDriveFileId);
    setRecordingDriveFileId(item.googleDriveFileId);
    setRecordingResolvedName(item.googleDriveFileId);
    setRecordingViewLink(driveViewLinkFromId(item.googleDriveFileId));
    setRecordingFetched(true);
    setRecordingSourceMode("url");
    setRecordingMimeType(item.mimeType ?? "video/mp4");
    setMaterials(
      item.materials.map((material) => ({
        id: crypto.randomUUID(),
        kind: material.kind,
        title: material.title,
        googleDriveFileId: material.googleDriveFileId,
        mimeType: material.mimeType ?? (material.kind === "PDF" ? "application/pdf" : "application/zip"),
        sourceMode: "url",
        driveInput: material.googleDriveFileId,
        resolvedName: material.title,
        viewLink: driveViewLinkFromId(material.googleDriveFileId),
        isFetched: true,
      })),
    );
    setMessage(`Editing ${item.videoId}. You can now add more materials and save.`);
    setError(null);
    setPickerTarget(null);
  }

  function removeMaterial(materialId: string) {
    setMaterials((prev) => prev.filter((material) => material.id !== materialId));
  }

  async function fetchRecordingFromDrive() {
    if (!recordingDriveInput.trim()) {
      setError("Paste a Google Drive file ID or link first.");
      return;
    }

    setFetchingRecording(true);
    setError(null);
    setMessage(null);
    try {
      const data = await fetchDriveFile(recordingDriveInput);
      setRecordingDriveFileId(data.id ?? "");
      setRecordingResolvedName(data.title ?? data.id ?? null);
      setRecordingViewLink(data.webViewLink ?? (data.id ? driveViewLinkFromId(data.id) : null));
      setRecordingFetched(true);
      if (data.title) {
        setRecordingDriveInput(data.title);
        if (!recordingTitle.trim()) {
          setRecordingTitle(data.title);
        }
      }
      if (data.mimeType) {
        setRecordingMimeType(data.mimeType);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch recording metadata.");
    } finally {
      setFetchingRecording(false);
    }
  }

  async function fetchMaterialFromDrive(materialId: string) {
    const material = materials.find((entry) => entry.id === materialId);
    if (!material || !material.driveInput.trim()) {
      setError("Paste a Google Drive file ID or link for this material first.");
      return;
    }

    setFetchingMaterialId(materialId);
    setError(null);
    setMessage(null);
    try {
      const data = await fetchDriveFile(material.driveInput);
      setMaterials((prev) =>
        prev.map((entry) => {
          if (entry.id !== materialId) return entry;
          const normalizedKind =
            data.mimeType === "application/pdf" ? "PDF" : data.mimeType === "application/zip" ? "ZIP" : entry.kind;
          return {
            ...entry,
            googleDriveFileId: data.id ?? "",
            driveInput: data.title ?? entry.driveInput,
            resolvedName: data.title ?? data.id ?? null,
            viewLink: data.webViewLink ?? (data.id ? driveViewLinkFromId(data.id) : entry.viewLink),
            isFetched: true,
            title: entry.title || data.title || entry.title,
            mimeType: data.mimeType ?? entry.mimeType,
            kind: normalizedKind,
          };
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch material metadata.");
    } finally {
      setFetchingMaterialId(null);
    }
  }

  async function openDrivePicker(target: PickerTarget) {
    setPickerTarget(target);
    setDriveError(null);
    setDriveLoading(true);
    try {
      const result = await listDriveFiles(driveQuery);
      setDriveFiles(result.files);
      setDriveNextPageToken(result.nextPageToken);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : "Failed to list Google Drive files.");
    } finally {
      setDriveLoading(false);
    }
  }

  async function searchDriveFiles() {
    setDriveError(null);
    setDriveLoading(true);
    try {
      const result = await listDriveFiles(driveQuery);
      setDriveFiles(result.files);
      setDriveNextPageToken(result.nextPageToken);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : "Failed to list Google Drive files.");
    } finally {
      setDriveLoading(false);
    }
  }

  async function loadMoreDriveFiles() {
    if (!driveNextPageToken) return;
    setDriveError(null);
    setDriveLoading(true);
    try {
      const result = await listDriveFiles(driveQuery, driveNextPageToken);
      setDriveFiles((prev) => [...prev, ...result.files]);
      setDriveNextPageToken(result.nextPageToken);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : "Failed to list Google Drive files.");
    } finally {
      setDriveLoading(false);
    }
  }

  function applyDriveFile(file: DriveFileResult) {
    if (!pickerTarget) {
      return;
    }

    if (pickerTarget.kind === "recording") {
      setRecordingSourceMode("browse");
      setRecordingDriveFileId(file.id);
      setRecordingResolvedName(file.title || file.id);
      setRecordingViewLink(file.webViewLink ?? driveViewLinkFromId(file.id));
      setRecordingFetched(true);
      if (!recordingTitle.trim()) {
        setRecordingTitle(file.title || recordingTitle);
      }
      if (file.mimeType) {
        setRecordingMimeType(file.mimeType);
      }
      setPickerTarget(null);
      return;
    }

    setMaterials((prev) =>
      prev.map((material) => {
        if (material.id !== pickerTarget.materialId) return material;
        const normalizedKind =
          file.mimeType === "application/pdf" ? "PDF" : file.mimeType === "application/zip" ? "ZIP" : material.kind;
        return {
          ...material,
          sourceMode: "browse",
          googleDriveFileId: file.id,
          resolvedName: file.title || file.id,
          viewLink: file.webViewLink ?? driveViewLinkFromId(file.id),
          isFetched: true,
          title: material.title || file.title || material.title,
          mimeType: file.mimeType || material.mimeType,
          kind: normalizedKind,
        };
      }),
    );
    setPickerTarget(null);
  }

  function formatFileSize(sizeBytes?: number): string {
    if (!sizeBytes || Number.isNaN(sizeBytes)) return "-";
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
            placeholder="Class date"
            type="date"
            value={classDate}
            onChange={(event) => setClassDate(event.target.value)}
          />
          <input
            className="field md:col-span-2"
            placeholder="Recording title (optional)"
            value={recordingTitle}
            onChange={(event) => setRecordingTitle(event.target.value)}
          />

          <div className="md:col-span-2 rounded-xl border border-[#d8e1f5] bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-[#4a5f93]">Recording source</span>
              <button
                className={`rounded-md px-2 py-1 text-xs ${recordingSourceMode === "url" ? "bg-[#1c64f2] text-white" : "text-[#24407a]"}`}
                onClick={() => setRecordingSourceMode("url")}
                type="button"
              >
                URL/ID
              </button>
              <button
                className={`rounded-md px-2 py-1 text-xs ${recordingSourceMode === "browse" ? "bg-[#1c64f2] text-white" : "text-[#24407a]"}`}
                onClick={() => {
                  setRecordingSourceMode("browse");
                  void openDrivePicker({ kind: "recording" });
                }}
                type="button"
              >
                Browse
              </button>
            </div>

            {recordingSourceMode === "url" ? (
              <div className="space-y-2">
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-[#00194c]"
                    placeholder="Recording Google Drive file ID or link"
                    required
                    value={recordingDriveInput}
                    onChange={(event) => {
                      setRecordingDriveInput(event.target.value);
                      setRecordingFetched(false);
                      setRecordingDriveFileId("");
                      setRecordingResolvedName(null);
                      setRecordingViewLink(null);
                    }}
                  />
                  <button
                    className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-sm text-[#00194c] hover:border-[#f39c12]"
                    disabled={fetchingRecording || loading}
                    onClick={fetchRecordingFromDrive}
                    type="button"
                  >
                    {fetchingRecording ? "Fetching..." : "Fetch"}
                  </button>
                </div>
                {recordingResolvedName ? (
                  <p className="text-sm text-[#24407a]">
                    File: {recordingResolvedName}
                    {recordingViewLink ? (
                      <>
                        {" "}
                        <a className="text-[#1c64f2] underline" href={recordingViewLink} rel="noreferrer" target="_blank">
                          View link
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {hasUnfetchedRecording ? (
                  <p className="text-sm text-amber-700">Warning: click Fetch before saving this recording source.</p>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <div className="rounded-lg border border-[#d8e1f5] bg-[#f8fbff] px-3 py-2 text-sm text-[#24407a]">
                  {recordingResolvedName ? `File: ${recordingResolvedName}` : "No file selected"}
                  {recordingViewLink ? (
                    <>
                      {" "}
                      <a className="text-[#1c64f2] underline" href={recordingViewLink} rel="noreferrer" target="_blank">
                        View link
                      </a>
                    </>
                  ) : null}
                </div>
                <button
                  className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-sm text-[#00194c] hover:border-[#f39c12]"
                  disabled={loading}
                  onClick={() => void openDrivePicker({ kind: "recording" })}
                  type="button"
                >
                  Browse Drive
                </button>
              </div>
            )}
          </div>

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
            <div className="space-y-2 rounded-xl border border-[#d8e1f5] bg-white p-3" key={material.id}>
              <div className="grid gap-2 md:grid-cols-3">
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
                  className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-[#00194c]"
                  placeholder="Material title"
                  required
                  value={material.title}
                  onChange={(event) => {
                    const next = [...materials];
                    next[index] = { ...next[index], title: event.target.value };
                    setMaterials(next);
                  }}
                />
                <div className="flex items-center gap-2 rounded-lg border border-[#d8e1f5] bg-white px-3 py-2">
                  <button
                    className={`rounded-md px-2 py-1 text-xs ${material.sourceMode === "url" ? "bg-[#1c64f2] text-white" : "text-[#24407a]"}`}
                    onClick={() => {
                      const next = [...materials];
                      next[index] = { ...next[index], sourceMode: "url" };
                      setMaterials(next);
                    }}
                    type="button"
                  >
                    URL/ID
                  </button>
                  <button
                    className={`rounded-md px-2 py-1 text-xs ${material.sourceMode === "browse" ? "bg-[#1c64f2] text-white" : "text-[#24407a]"}`}
                    onClick={() => {
                      const next = [...materials];
                      next[index] = { ...next[index], sourceMode: "browse" };
                      setMaterials(next);
                      void openDrivePicker({ kind: "material", materialId: material.id });
                    }}
                    type="button"
                  >
                    Browse
                  </button>
                </div>
              </div>

              {material.sourceMode === "url" ? (
                <div className="space-y-2">
                  <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    <input
                      className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-[#00194c]"
                      placeholder="Material Google Drive file ID or link"
                      required
                      value={material.driveInput}
                      onChange={(event) => {
                        const next = [...materials];
                        next[index] = {
                          ...next[index],
                          driveInput: event.target.value,
                          isFetched: false,
                          googleDriveFileId: "",
                          resolvedName: null,
                          viewLink: null,
                        };
                        setMaterials(next);
                      }}
                    />
                    <button
                      className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-xs text-[#00194c] hover:border-[#f39c12]"
                      disabled={loading || fetchingMaterialId === material.id}
                      onClick={() => void fetchMaterialFromDrive(material.id)}
                      type="button"
                    >
                      {fetchingMaterialId === material.id ? "Fetching..." : "Fetch"}
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-lg border border-[#ffd6d6] bg-[#fff6f6] px-3 py-2 text-[#a33] hover:border-[#ffb3b3]"
                      onClick={() => removeMaterial(material.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {material.resolvedName ? (
                    <p className="text-sm text-[#24407a]">
                      File: {material.resolvedName}
                      {material.viewLink ? (
                        <>
                          {" "}
                          <a className="text-[#1c64f2] underline" href={material.viewLink} rel="noreferrer" target="_blank">
                            View link
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {material.driveInput.trim() && !material.isFetched ? (
                    <p className="text-sm text-amber-700">Warning: click Fetch before saving this material source.</p>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <div className="rounded-lg border border-[#d8e1f5] bg-[#f8fbff] px-3 py-2 text-sm text-[#24407a]">
                    {material.resolvedName ? `File: ${material.resolvedName}` : "No file selected"}
                    {material.viewLink ? (
                      <>
                        {" "}
                        <a className="text-[#1c64f2] underline" href={material.viewLink} rel="noreferrer" target="_blank">
                          View link
                        </a>
                      </>
                    ) : null}
                  </div>
                  <button
                    className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-xs text-[#00194c] hover:border-[#f39c12]"
                    disabled={loading}
                    onClick={() => void openDrivePicker({ kind: "material", materialId: material.id })}
                    type="button"
                  >
                    Browse Drive
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-lg border border-[#ffd6d6] bg-[#fff6f6] px-3 py-2 text-[#a33] hover:border-[#ffb3b3]"
                    onClick={() => removeMaterial(material.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
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

        {(hasUnfetchedRecording || hasUnfetchedMaterials) ? (
          <p className="text-sm text-amber-700">You have URL/ID sources that are not fetched yet. Fetch them before saving.</p>
        ) : null}

        <button
          className="btn-primary"
          disabled={loading || fetchingRecording || Boolean(fetchingMaterialId) || hasUnfetchedRecording || hasUnfetchedMaterials}
          type="submit"
        >
          {loading ? "Saving..." : selectedVideoId ? "Save changes" : "Save catalog entry"}
        </button>
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

      </form>

      {pickerTarget ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#00194c]/45 p-4"
          onClick={() => setPickerTarget(null)}
          role="dialog"
          aria-modal="true"
        >
          <section
            className="w-full max-w-5xl rounded-2xl border border-[#d8e1f5] bg-[#f8fbff] p-4 shadow-[0_30px_90px_rgba(8,28,76,0.3)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#12316a]">
                Browse Google Drive ({pickerTarget.kind === "recording" ? "Recording" : "Material"} target)
              </p>
              <button
                className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-xs text-[#00194c] hover:border-[#f39c12]"
                onClick={() => setPickerTarget(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="field min-w-[260px] flex-1"
                placeholder="Search file name (leave blank for recent files)"
                value={driveQuery}
                onChange={(event) => setDriveQuery(event.target.value)}
              />
              <button
                className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-sm text-[#00194c] hover:border-[#f39c12]"
                disabled={driveLoading}
                onClick={() => void searchDriveFiles()}
                type="button"
              >
                {driveLoading ? "Searching..." : "Search"}
              </button>
            </div>

            {driveError ? <p className="mt-3 text-sm text-red-600">{driveError}</p> : null}

            <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-[#e3eaf8] bg-white">
              {driveFiles.length === 0 && !driveLoading ? (
                <p className="p-3 text-sm text-[#4a5f93]">No files found.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#f2f7ff] text-[#6a7dab]">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driveFiles.map((file) => (
                      <tr className="border-t border-[#e3eaf8]" key={file.id}>
                        <td className="px-3 py-2">{file.title}</td>
                        <td className="px-3 py-2">{file.mimeType}</td>
                        <td className="px-3 py-2">{formatFileSize(file.sizeBytes)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-[#4a5f93]">{file.id}</td>
                        <td className="px-3 py-2">
                          <button
                            className="rounded-lg border border-[#d8e1f5] bg-white px-2 py-1 text-xs text-[#00194c] hover:border-[#f39c12]"
                            onClick={() => applyDriveFile(file)}
                            type="button"
                          >
                            Use file
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-3">
              <button
                className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-sm text-[#00194c] hover:border-[#f39c12] disabled:opacity-50"
                disabled={!driveNextPageToken || driveLoading}
                onClick={() => void loadMoreDriveFiles()}
                type="button"
              >
                {driveLoading ? "Loading..." : "Load more"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="card">
        <h2 className="text-xl font-semibold">Catalog Entries</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[#6a7dab]">
              <tr>
                <th className="px-2 py-2">Video ID</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2">Date</th>
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

