'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Shield,
  Eye
} from 'lucide-react';
import { InstrumentAttachment } from '@/types/metrology';

export type AttachmentCategory = 'NAMEPLATE' | 'LEAD_SEAL' | 'LEVEL_BUBBLE' | 'OVERALL_FRONT';

interface PhotoDropzoneProps {
  attachments: InstrumentAttachment[];
  onChange: (attachments: InstrumentAttachment[]) => void;
  disabled?: boolean;
}

const CATEGORY_DEFINITIONS: {
  type: AttachmentCategory;
  label: string;
  badgeColor: string;
  description: string;
  required: boolean;
}[] = [
  {
    type: 'NAMEPLATE',
    label: 'Nameplate & Markings',
    badgeColor: 'bg-ink-950 text-white border-ink-950',
    description: 'Displays Class, Max, Min, e, d, and serial number',
    required: true,
  },
  {
    type: 'LEAD_SEAL',
    label: 'Lead / Wire Tamper Seal',
    badgeColor: 'bg-neutral-800 text-white border-neutral-800',
    description: 'Physical wire/lead seal protecting calibration pots',
    required: true,
  },
  {
    type: 'LEVEL_BUBBLE',
    label: 'Spirit Level / Bubble',
    badgeColor: 'bg-neutral-100 text-ink-900 border-editorial-border',
    description: 'Confirms platter is centered in reference position',
    required: true,
  },
  {
    type: 'OVERALL_FRONT',
    label: 'Overall Front / Receptor',
    badgeColor: 'bg-neutral-100 text-ink-900 border-editorial-border',
    description: 'Full load receptor and indicator configuration',
    required: false,
  },
];

export default function PhotoDropzone({
  attachments,
  onChange,
  disabled = false,
}: PhotoDropzoneProps) {
  const [selectedCategory, setSelectedCategory] = useState<AttachmentCategory>('NAMEPLATE');
  const [dragActive, setDragActive] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;

    const newAttachments: InstrumentAttachment[] = [];
    Array.from(files).forEach((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      newAttachments.push({
        id: `temp-${Date.now()}-${index}`,
        attachment_type: selectedCategory,
        storage_path: previewUrl,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      });
    });

    onChange([...attachments, ...newAttachments]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = (indexToRemove: number) => {
    if (disabled) return;
    onChange(attachments.filter((_, idx) => idx !== indexToRemove));
  };

  const uploadedCategories = new Set(attachments.map((a) => a.attachment_type));
  const missingRequired = CATEGORY_DEFINITIONS.filter(
    (c) => c.required && !uploadedCategories.has(c.type)
  );

  return (
    <div className="space-y-4">
      {/* Category Selection Bar */}
      <div className="space-y-2">
        <label className="text-[10px] font-mono font-bold text-ink-500 block uppercase tracking-widest">
          1. Select Evidence Tag for Upload
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORY_DEFINITIONS.map((cat) => {
            const isSelected = selectedCategory === cat.type;
            const isUploaded = uploadedCategories.has(cat.type);
            return (
              <button
                key={cat.type}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedCategory(cat.type)}
                className={`p-3 border text-left transition-all relative ${
                  isSelected
                    ? 'border-ink-950 bg-ink-950 text-white shadow-editorial'
                    : 'border-editorial-border bg-white text-ink-900 hover:border-ink-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono tracking-tight block truncate">
                    {cat.label}
                  </span>
                  {isUploaded ? (
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                  ) : cat.required ? (
                    <span className={`text-[9px] font-mono font-bold uppercase ${isSelected ? 'text-neutral-300' : 'text-ink-500'}`}>Req</span>
                  ) : null}
                </div>
                <p className={`text-[10px] font-mono line-clamp-1 mt-1 ${isSelected ? 'text-neutral-300' : 'text-ink-400'}`}>
                  {cat.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`border-2 border-dashed p-6 text-center transition-all cursor-pointer bg-white ${
          dragActive
            ? 'border-ink-950 bg-alabaster-100 scale-[0.99]'
            : 'border-editorial-border hover:border-ink-950'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="p-3 bg-ink-950 text-white shadow-editorial">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-ink-950">
            Click to upload or drag & drop photographs
          </div>
          <p className="text-[11px] font-mono text-ink-500 uppercase">
            TARGET EVIDENCE CATEGORY:{' '}
            <span className="font-bold text-ink-950">
              {CATEGORY_DEFINITIONS.find((c) => c.type === selectedCategory)?.label}
            </span>{' '}
            (JPEG, PNG, WebP UP TO 15MB)
          </p>
        </div>
      </div>

      {/* Mandatory Category Check Banner */}
      {missingRequired.length > 0 && (
        <div className="p-4 bg-white border border-editorial-border shadow-editorial flex items-start gap-3 text-xs font-mono">
          <AlertCircle className="w-4 h-4 text-ink-950 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-ink-950">
              ISO/IEC 17025 PHOTOGRAPHIC EVIDENCE REQUIREMENT:
            </span>
            <p className="text-[11px] text-ink-600 mt-1 uppercase">
              Missing mandatory verification photos:{' '}
              {missingRequired.map((m) => m.label).join(', ')}. Please upload before final sign-off.
            </p>
          </div>
        </div>
      )}

      {/* Gallery / Staged Photos Grid */}
      {attachments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-ink-950 uppercase tracking-widest">
            <span>UPLOADED EVIDENCE VAULT ({attachments.length})</span>
            <span className="text-[10px] text-ink-400">
              TAMPER-EVIDENT RECORD
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {attachments.map((att, idx) => {
              const catDef = CATEGORY_DEFINITIONS.find((c) => c.type === att.attachment_type);
              return (
                <div
                  key={att.id || idx}
                  className="group relative border border-editorial-border bg-white overflow-hidden shadow-editorial flex flex-col"
                >
                  <div className="h-28 bg-alabaster-100 relative overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.storage_path}
                      alt={att.file_name || 'Attachment'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewModalUrl(att.storage_path);
                        }}
                        className="p-1.5 bg-white text-ink-950 text-xs font-bold hover:bg-neutral-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(idx);
                          }}
                          className="p-1.5 bg-ink-950 text-white hover:bg-rose-700 text-xs font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-2 space-y-1">
                    <span
                      className={`inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider ${
                        catDef?.badgeColor || 'bg-neutral-100 text-ink-900 border border-editorial-border'
                      }`}
                    >
                      {catDef?.label || att.attachment_type}
                    </span>
                    <p className="text-[10px] font-mono text-ink-500 truncate">
                      {att.file_name || 'evidence_capture.jpg'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewModalUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] bg-slate-900 rounded-2xl overflow-hidden p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewModalUrl}
              alt="Evidence Full View"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded-xl"
            />
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-2 text-xs font-bold hover:bg-black"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
