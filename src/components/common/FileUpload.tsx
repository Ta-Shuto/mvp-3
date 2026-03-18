"use client";

import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";

interface FileUploadProps {
  caseId?: string;
  meetingId?: string;
  onUploadComplete?: () => void;
}

const categoryLabels: Record<string, string> = {
  general: "一般",
  evidence: "証拠資料",
  report: "報告書",
  audio: "音声記録",
  other: "その他",
};

const fileSizeFormat = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const mimeTypeIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "sheet";
  if (mimeType.includes("document") || mimeType.includes("word")) return "doc";
  return "file";
};

export function FileUpload({ caseId, meetingId, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("general");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const files = trpc.fileAttachment.listByCase.useQuery(
    { caseId: caseId! },
    { enabled: !!caseId }
  );
  const registerFile = trpc.fileAttachment.register.useMutation({
    onSuccess: () => {
      files.refetch();
      onUploadComplete?.();
    },
  });
  const deleteFile = trpc.fileAttachment.delete.useMutation({
    onSuccess: () => files.refetch(),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      const result = await res.json();

      await registerFile.mutateAsync({
        caseId,
        meetingId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        s3Key: result.s3Key,
        category,
      });
    } catch (err: any) {
      setError(err.message ?? "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors">
        <input
          ref={fileRef}
          type="file"
          onChange={handleUpload}
          className="hidden"
          id="file-upload"
          disabled={uploading}
        />
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-2 py-1 border border-border rounded-lg text-sm bg-background"
            >
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <label
              htmlFor="file-upload"
              className={`px-4 py-2 rounded-lg text-base font-medium cursor-pointer transition-colors ${
                uploading ? "bg-gray-100 text-gray-400" : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {uploading ? "アップロード中..." : "ファイルを選択"}
            </label>
          </div>
          <span className="text-sm text-muted-foreground">
            PDF, Word, Excel, 画像, 音声 (50MBまで)
          </span>
        </div>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>

      {/* File list */}
      {files.data && files.data.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">添付ファイル ({files.data.length})</h4>
          {files.data.map((file: any) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-white/30 rounded-xl border border-border/50"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                {mimeTypeIcon(file.mimeType).slice(0, 3).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.fileName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{fileSizeFormat(file.fileSize)}</span>
                  <span>{categoryLabels[file.category] ?? file.category}</span>
                  <span>{file.uploadedBy?.name}</span>
                  <span>{new Date(file.createdAt).toLocaleDateString("ja-JP")}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <a
                  href={`/api/files/download?key=${encodeURIComponent(file.s3Key)}`}
                  className="px-2 py-1 text-xs border border-border rounded hover:bg-accent"
                  download
                >
                  DL
                </a>
                <button
                  onClick={() => {
                    if (confirm("このファイルを削除しますか？")) {
                      deleteFile.mutate({ id: file.id });
                    }
                  }}
                  className="px-2 py-1 text-xs border border-border rounded hover:bg-red-50 hover:text-red-600"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
