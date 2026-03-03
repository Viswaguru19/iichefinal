// ============================================
// DOCUMENT MANAGEMENT UTILITIES
// Central document system with filtering
// ============================================

import { createClient } from '@/lib/supabase/client';
import type { DocumentType, DocumentFilters } from '@/types/database';

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

    if (docError) throw docError;

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

    if (error) throw error;

    return data || [];
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
