import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/axios';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';

/**
 * Format bytes into human readable size
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format date string into readable format
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * ResumeUploader Component
 *
 * Provides:
 * 1. Drag-and-drop file dropzone + click-to-browse file picker
 * 2. Progress bar and status feedback during upload
 * 3. List of uploaded resumes with delete capability & selection
 */
export default function ResumeUploader({
  onUploadSuccess,
  onDeleteSuccess,
  onSelectResume,
  selectedResumeId,
  className = '',
}) {
  const [resumes, setResumes] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fileInputRef = useRef(null);
  const toast = useToast();

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

  // Stable refs for props to avoid re-triggering fetch effect
  const onSelectResumeRef = useRef(onSelectResume);
  useEffect(() => {
    onSelectResumeRef.current = onSelectResume;
  }, [onSelectResume]);

  const selectedResumeIdRef = useRef(selectedResumeId);
  useEffect(() => {
    selectedResumeIdRef.current = selectedResumeId;
  }, [selectedResumeId]);

  // Fetch resumes list once on mount
  useEffect(() => {
    let isMounted = true;

    const fetchResumes = async () => {
      setIsLoadingList(true);
      try {
        const res = await api.get('/api/resumes');
        const list = Array.isArray(res.data) ? res.data : res.data.resumes || [];
        if (isMounted) {
          setResumes(list);
          // If no resume currently selected, select the latest one automatically
          if (list.length > 0 && !selectedResumeIdRef.current && onSelectResumeRef.current) {
            onSelectResumeRef.current(list[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load resumes:', err);
        if (isMounted) {
          toast.error('Failed to load your uploaded resumes');
        }
      } finally {
        if (isMounted) {
          setIsLoadingList(false);
        }
      }
    };

    fetchResumes();

    return () => {
      isMounted = false;
    };
  }, []); // Run only once on mount

  // Validate file
  const validateFile = (file) => {
    if (!file) return false;

    const ext = `.${file.name.split('.').pop().toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('Invalid file format. Please upload a PDF or DOCX file.');
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds the 5MB limit.');
      return false;
    }

    return true;
  };

  // Upload file handler
  const handleUpload = async (file) => {
    if (!validateFile(file)) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadingFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('resume', file);

    try {
      const response = await api.post('/api/resumes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });

      const uploadedDoc = response.data.resume || response.data;
      const normalizedResume = {
        id: uploadedDoc.id || uploadedDoc._id,
        name: uploadedDoc.originalFilename || file.name,
        originalFilename: uploadedDoc.originalFilename || file.name,
        uploadedAt: uploadedDoc.uploadedAt || new Date().toISOString(),
        createdAt: uploadedDoc.createdAt || new Date().toISOString(),
        parsedSections: uploadedDoc.parsedSections,
      };

      setResumes((prev) => [normalizedResume, ...prev]);
      toast.success('Resume uploaded and parsed successfully!');

      if (onUploadSuccess) {
        onUploadSuccess(uploadedDoc);
      }
      if (onSelectResume) {
        onSelectResume(normalizedResume);
      }
    } catch (err) {
      console.error('Resume upload error:', err);
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to upload and parse resume';
      toast.error(message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Drag and drop event listeners
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only deactivate if leaving the container
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleUpload(file);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  // Delete resume handler
  const handleDeleteResume = async (resumeId, e) => {
    if (e) e.stopPropagation();

    setDeletingId(resumeId);
    try {
      await api.delete(`/api/resumes/${resumeId}`);
      setResumes((prev) => prev.filter((r) => r.id !== resumeId));
      toast.success('Resume deleted');

      if (confirmDeleteId === resumeId) {
        setConfirmDeleteId(null);
      }

      if (onDeleteSuccess) {
        onDeleteSuccess(resumeId);
      }

      // If deleted resume was active selection, fallback to first available
      if (selectedResumeId === resumeId) {
        const remaining = resumes.filter((r) => r.id !== resumeId);
        if (remaining.length > 0 && onSelectResume) {
          onSelectResume(remaining[0]);
        } else if (onSelectResume) {
          onSelectResume(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete resume:', err);
      const message =
        err.response?.data?.message || err.response?.data?.error || 'Failed to delete resume';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Drag-and-Drop Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 sm:p-10 transition-all duration-200 text-center ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
        } ${isUploading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Cloud Upload Icon */}
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${
              isDragging
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'bg-slate-800 text-slate-400 group-hover:text-blue-400 group-hover:bg-slate-800/90'
            }`}
          >
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <div className="space-y-1">
            <p className="text-base font-medium text-slate-200">
              <span className="text-blue-400 group-hover:underline">Click to browse</span> or drag
              and drop your resume
            </p>
            <p className="text-xs text-slate-500">Supports PDF and DOCX up to 5MB</p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isUploading}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Choose File
          </Button>
        </div>

        {/* 2. Upload Progress Bar */}
        {isUploading && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 text-left space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300 truncate max-w-[240px]">
                {uploadingFileName || 'Uploading document...'}
              </span>
              <span className="text-blue-400 font-semibold">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-teal-400 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 animate-pulse">
              <svg
                className="w-3.5 h-3.5 animate-spin text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {uploadProgress < 100
                ? 'Uploading file to server...'
                : 'Extracting contact, summary, skills & experience sections...'}
            </p>
          </div>
        )}
      </div>

      {/* 3. Uploaded Resumes List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Uploaded Resumes ({resumes.length})
          </h2>
          {resumes.length > 0 && (
            <span className="text-xs text-slate-500">
              Select a resume to view details or tailor
            </span>
          )}
        </div>

        {isLoadingList ? (
          <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-slate-800 space-y-2">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
            <p className="text-xs text-slate-400">Loading your resumes...</p>
          </div>
        ) : resumes.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-slate-800/80">
            <svg
              className="w-10 h-10 mx-auto text-slate-600 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm font-medium text-slate-400">No resumes uploaded yet</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag and drop your file above to parse and extract your career history.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {resumes.map((resume) => {
              const isSelected = selectedResumeId === resume.id;
              const isDeleting = deletingId === resume.id;
              const isConfirming = confirmDeleteId === resume.id;
              const isPdf = (resume.originalFilename || resume.name || '').endsWith('.pdf');

              return (
                <li
                  key={resume.id}
                  onClick={() => onSelectResume && onSelectResume(resume)}
                  className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-blue-950/30 border-blue-500/80 shadow-sm shadow-blue-500/10'
                      : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  } ${onSelectResume ? 'cursor-pointer' : ''}`}
                >
                  {/* Left: Document Icon & Details */}
                  <div className="flex items-center gap-3.5 min-w-0 pr-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs uppercase ${
                        isPdf
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {isPdf ? 'PDF' : 'DOCX'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                          {resume.name || resume.originalFilename}
                        </p>
                        {isSelected && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>Uploaded {formatDate(resume.uploadedAt || resume.createdAt)}</span>
                        {resume.fileSize && (
                          <>
                            <span>•</span>
                            <span>{formatFileSize(resume.fileSize)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isConfirming ? (
                      <div
                        className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-red-900/50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs text-red-400 px-1 font-medium">Delete?</span>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={(e) => handleDeleteResume(resume.id, e)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition"
                        >
                          {isDeleting ? '...' : 'Yes'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label="Delete resume"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(resume.id);
                        }}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete resume"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
