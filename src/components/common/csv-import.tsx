"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload, FileUp } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type CsvColumn = {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
};

type BulkResult = {
  created: number;
  failed: number;
  errors: { row: number; email?: string; error: string }[];
  credentials?: { email: string; tempPassword: string }[];
};

function downloadTemplate(
  columns: CsvColumn[],
  filename: string,
  samples?: Record<string, string>[],
) {
  const fields = columns.map((c) => c.key);
  // Use provided sample rows, else a single row built from each column's example.
  const rows =
    samples && samples.length > 0
      ? samples.map((s) => {
          const row: Record<string, string> = {};
          for (const c of columns) row[c.key] = s[c.key] ?? c.example ?? "";
          return row;
        })
      : [Object.fromEntries(columns.map((c) => [c.key, c.example ?? ""]))];
  const csv = Papa.unparse({ fields, data: rows });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvImport({
  title,
  columns,
  endpoint,
  templateFilename = "template.csv",
  triggerLabel = "Import CSV",
  samples,
  onDone,
}: {
  title: string;
  columns: CsvColumn[];
  endpoint: string;
  templateFilename?: string;
  triggerLabel?: string;
  samples?: Record<string, string>[];
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const requiredKeys = columns.filter((c) => c.required).map((c) => c.key);
  const invalidCount = rows.filter((r) =>
    requiredKeys.some((k) => !String(r[k] ?? "").trim()),
  ).length;

  const upload = useMutation({
    mutationFn: () => api.post<{ data: BulkResult }>(endpoint, { rows }),
    onSuccess: (res) => {
      setResult(res.data);
      toast.success(`Imported ${res.data.created} rows`);
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setRows([]);
    setFileName(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        setRows(res.data);
        setFileName(file.name);
        setResult(null);
      },
      error: () => toast.error("Could not parse CSV"),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Download the template, fill it in, and upload. Columns:{" "}
            {columns.map((c) => c.key).join(", ")}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate(columns, templateFilename, samples)}
          >
            <Download className="size-4" /> Download template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" /> Choose CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>

        {fileName && !result && (
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{fileName}</p>
            <p className="text-muted-foreground">
              {rows.length} rows
              {invalidCount > 0 && (
                <span className="text-destructive">
                  {" "}
                  · {invalidCount} missing required fields
                </span>
              )}
            </p>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <p>
              <span className="font-medium text-green-600">{result.created} created</span>
              {result.failed > 0 && (
                <span className="text-destructive"> · {result.failed} failed</span>
              )}
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
                {result.errors.map((er, i) => (
                  <p key={i}>
                    Row {er.row}
                    {er.email ? ` (${er.email})` : ""}: {er.error}
                  </p>
                ))}
              </div>
            )}
            {result.credentials && result.credentials.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded bg-muted p-2 font-mono text-xs">
                {result.credentials.map((c, i) => (
                  <p key={i}>
                    {c.email} — {c.tempPassword}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {rows.length > 0 && !result && (
          <Button disabled={upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? "Importing…" : `Import ${rows.length} rows`}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
