// ============================================
// DOCUMENT MANAGEMENT UTILITIES
// Central document system with filtering
// ============================================

import { createClient } from '@/lib/supabase/client';
import type { DocumentType, DocumentFilters } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

const DOCUMENTS_BUCKET = 'documents';

/** If DB stored a JSON blob instead of a plain URL, return the usable URL string. */
export function unwrapStoredFileUrl(raw: string | null | undefined): string {
    if (raw == null) return '';
    const t = String(raw).trim();
    if (!t.startsWith('{')) return t;
    try {
        const j = JSON.parse(t) as { publicUrl?: string; signedUrl?: string };
        if (typeof j.publicUrl === 'string' && j.publicUrl.trim()) return j.publicUrl.trim();
        if (typeof j.signedUrl === 'string' && j.signedUrl.trim()) return j.signedUrl.trim();
    } catch {
        /* ignore */
    }
    return t;
}

/** Path inside the `documents` bucket, or null if this is not a documents-bucket reference. */
export function extractDocumentsBucketObjectPath(raw: string | null | undefined): string | null {
    if (raw == null) return null;
    let s = unwrapStoredFileUrl(String(raw));
    if (!s) return null;

    const markers = ['/object/public/documents/', '/object/sign/documents/'] as const;
    for (const m of markers) {
        const idx = s.indexOf(m);
        if (idx !== -1) {
            const rest = s.slice(idx + m.length).split(/[?#]/)[0];
            if (rest) {
                try {
                    return decodeURIComponent(rest);
                } catch {
                    return rest;
                }
            }
        }
    }

    if (!/^https?:\/\//i.test(s)) {
        const path = s.replace(/^\/+/, '');
        return path || null;
    }

    return null;
}

/** Stable public URL for committee / dashboard documents (fixes path-only or relative `file_url` values). */
export function resolveDocumentsBucketPublicUrl(supabase: SupabaseClient, raw: string | null | undefined): string {
    const path = extractDocumentsBucketObjectPath(raw);
    if (path) {
        const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
        return data.publicUrl;
    }
    const s = unwrapStoredFileUrl(raw == null ? '' : String(raw));
    if (/^https?:\/\//i.test(s)) return s;
    return '#';
}

/** Open file in a new tab: signed URL when possible, else reconstructed public URL. */
export async function openDocumentsBucketFile(supabase: SupabaseClient, raw: string | null | undefined): Promise<void> {
    const path = extractDocumentsBucketObjectPath(raw);
    if (path) {
        const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) {
            window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
            return;
        }
    }
    const publicUrl = resolveDocumentsBucketPublicUrl(supabase, raw);
    if (publicUrl !== '#') window.open(publicUrl, '_blank', 'noopener,noreferrer');
}

// ============================================
// DOCUMENT UPLOAD
// ============================================

export async function uploadDocument(
    file: File,
    metadata: {
        title: string;
        document_type: DocumentType;
        committee_id?: string;
        event_id?: string;
        task_id?: string;
        tags?: string[];
    },
    uploadedBy: string
) {
    const supabase = createClient();

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `documents/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

    // Create document record
    const now = new Date();

    // Try inserting into documents table first
    const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
            title: metadata.title,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            document_type: metadata.document_type,
            uploaded_by: uploadedBy,
            committee_id: metadata.committee_id,
            event_id: metadata.event_id,
            task_id: metadata.task_id,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            tags: metadata.tags || [],
            metadata: {
                original_name: file.name,
                uploaded_at: now.toISOString(),
            },
        })
        .select()
        .single();

    // If documents table fails (RLS or doesn't exist), try committee_documents
    if (docError) {
        console.error('documents table insert failed:', docError.message);

        if (metadata.committee_id) {
            const { data: cdDoc, error: cdError } = await supabase
                .from('committee_documents')
                .insert({
                    committee_id: metadata.committee_id,
                    title: metadata.title,
                    file_url: publicUrl,
                    file_type: file.type,
                    uploaded_by: uploadedBy,
                })
                .select()
                .single();

            if (cdError) {
                console.error('committee_documents insert also failed:', cdError.message);
                throw docError; // throw original error
            }
            return cdDoc;
        }
        throw docError;
    }

    return document;
}

// ============================================
// DOCUMENT QUERIES
// ============================================

export async function getDocuments(filters: DocumentFilters = {}) {
    const supabase = createClient();

    let query = supabase
        .from('documents')
        .select(`
      *,
      uploader:profiles!documents_uploaded_by_fkey(id, name, avatar_url),
      committee:committees(id, name),
      event:events(id, title),
      task:tasks(id, title)
    `)
        .order('created_at', { ascending: false });

    // Apply filters
    if (filters.year) {
        query = query.eq('year', filters.year);
    }
    if (filters.month) {
        query = query.eq('month', filters.month);
    }
    if (filters.event_id) {
        query = query.eq('event_id', filters.event_id);
    }
    if (filters.committee_id) {
        query = query.eq('committee_id', filters.committee_id);
    }
    if (filters.task_id) {
        query = query.eq('task_id', filters.task_id);
    }
    if (filters.uploaded_by) {
        query = query.eq('uploaded_by', filters.uploaded_by);
    }
    if (filters.document_type) {
        query = query.eq('document_type', filters.document_type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
}

export async function getDocumentById(documentId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('documents')
        .select(`
      *,
      uploader:profiles!documents_uploaded_by_fkey(id, name, email, avatar_url),
      committee:committees(id, name),
      event:events(id, title),
      task:tasks(id, title)
    `)
        .eq('id', documentId)
        .single();

    if (error) throw error;

    return data;
}

export async function getTaskDocuments(taskId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('documents')
        .select(`
      *,
      uploader:profiles!documents_uploaded_by_fkey(id, name, avatar_url)
    `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
}

export async function getEventDocuments(eventId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('documents')
        .select(`
      *,
      uploader:profiles!documents_uploaded_by_fkey(id, name, avatar_url)
    `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
}

export async function getCommitteeDocuments(committeeId: string) {
    const supabase = createClient();

    // Try documents table first
    const { data, error } = await supabase
        .from('documents')
        .select(`
      *,
      uploader:profiles!documents_uploaded_by_fkey(id, name, avatar_url),
      event:events(id, title),
      task:tasks(id, title)
    `)
        .eq('committee_id', committeeId)
        .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) return data;

    // Fallback to committee_documents table
    const { data: cdData, error: cdError } = await supabase
        .from('committee_documents')
        .select('*')
        .eq('committee_id', committeeId)
        .order('created_at', { ascending: false });

    if (cdError) {
        console.error('committee_documents query failed:', cdError.message);
        return data || []; // return whatever documents table returned
    }

    return cdData || [];
}

// ============================================
// DOCUMENT DELETION
// ============================================

export async function deleteDocument(documentId: string, userId: string) {
    const supabase = createClient();

    // Get document
    const { data: document } = await supabase
        .from('documents')
        .select('uploaded_by, file_url')
        .eq('id', documentId)
        .single();

    if (!document) throw new Error('Document not found');

    // Check permission (uploader or admin)
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

    if (document.uploaded_by !== userId && !profile?.is_admin) {
        throw new Error('You do not have permission to delete this document');
    }

    // Extract file path from URL
    const urlParts = document.file_url.split('/');
    const filePath = `documents/${urlParts[urlParts.length - 1]}`;

    // Delete from storage
    const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

    if (storageError) console.error('Failed to delete file from storage:', storageError);

    // Delete record
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

    if (error) throw error;
}

// ============================================
// DOCUMENT SEARCH
// ============================================

export async function searchDocuments(query: string, filters: DocumentFilters = {}) {
    const supabase = createClient();

    let dbQuery = supabase
        .from('documents')
        .select(`
      *,
      uploader:profiles!documents_uploaded_by_fkey(id, name, avatar_url),
      committee:committees(id, name),
      event:events(id, title),
      task:tasks(id, title)
    `)
        .or(`title.ilike.%${query}%,tags.cs.{${query}}`)
        .order('created_at', { ascending: false });

    // Apply additional filters
    if (filters.year) dbQuery = dbQuery.eq('year', filters.year);
    if (filters.month) dbQuery = dbQuery.eq('month', filters.month);
    if (filters.committee_id) dbQuery = dbQuery.eq('committee_id', filters.committee_id);
    if (filters.document_type) dbQuery = dbQuery.eq('document_type', filters.document_type);

    const { data, error } = await dbQuery;

    if (error) throw error;

    return data || [];
}

// ============================================
// DOCUMENT STATISTICS
// ============================================

export async function getDocumentStats(committeeId?: string) {
    const supabase = createClient();

    let query = supabase
        .from('documents')
        .select('document_type, file_size', { count: 'exact' });

    if (committeeId) {
        query = query.eq('committee_id', committeeId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Calculate stats
    const stats = {
        total: count || 0,
        by_type: {} as Record<string, number>,
        total_size: 0,
    };

    data?.forEach((doc) => {
        stats.by_type[doc.document_type] = (stats.by_type[doc.document_type] || 0) + 1;
        stats.total_size += doc.file_size || 0;
    });

    return stats;
}

// ============================================
// FILTER OPTIONS
// ============================================

export async function getAvailableYears() {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('documents')
        .select('year')
        .order('year', { ascending: false });

    if (error) throw error;

    const years = [...new Set(data?.map((d) => d.year).filter(Boolean))];
    return years;
}

export async function getAvailableMonths(year: number) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('documents')
        .select('month')
        .eq('year', year)
        .order('month', { ascending: false });

    if (error) throw error;

    const months = [...new Set(data?.map((d) => d.month).filter(Boolean))];
    return months;
}

// ============================================
// BULK OPERATIONS
// ============================================

export async function bulkDeleteDocuments(documentIds: string[], userId: string) {
    const supabase = createClient();

    // Check if user is admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

    if (!profile?.is_admin) {
        throw new Error('Only admins can bulk delete documents');
    }

    // Get documents
    const { data: documents } = await supabase
        .from('documents')
        .select('id, file_url')
        .in('id', documentIds);

    if (!documents) return;

    // Delete from storage
    const filePaths = documents.map((doc) => {
        const urlParts = doc.file_url.split('/');
        return `documents/${urlParts[urlParts.length - 1]}`;
    });

    await supabase.storage.from('documents').remove(filePaths);

    // Delete records
    const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', documentIds);

    if (error) throw error;
}

export async function bulkUpdateTags(documentIds: string[], tags: string[], userId: string) {
    const supabase = createClient();

    const { error } = await supabase
        .from('documents')
        .update({ tags })
        .in('id', documentIds);

    if (error) throw error;
}

// ============================================
// DOCUMENT DOWNLOAD
// ============================================

export async function downloadDocument(documentId: string) {
    const supabase = createClient();

    const { data: document } = await supabase
        .from('documents')
        .select('file_url, title')
        .eq('id', documentId)
        .single();

    if (!document) throw new Error('Document not found');

    // Trigger download
    const link = window.document.createElement('a');
    link.href = document.file_url;
    link.download = document.title;
    link.click();
}

// ============================================
// DOCUMENT SHARING
// ============================================

export async function generateShareableLink(documentId: string, expiresIn: number = 3600) {
    const supabase = createClient();

    const { data: document } = await supabase
        .from('documents')
        .select('file_url')
        .eq('id', documentId)
        .single();

    if (!document) throw new Error('Document not found');

    // Extract file path
    const urlParts = document.file_url.split('/');
    const filePath = `documents/${urlParts[urlParts.length - 1]}`;

    // Create signed URL
    const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, expiresIn);

    if (error) throw error;

    return data.signedUrl;
}
