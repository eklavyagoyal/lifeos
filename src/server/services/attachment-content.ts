import { execFileSync } from 'child_process';
import fs from 'fs';
import type { AttachmentSearchStatus } from '@/lib/types';

const MAX_TEXT_FILE_BYTES = 512 * 1024;
const MAX_SEARCH_TEXT_LENGTH = 12_000;
const MAX_SUMMARY_LENGTH = 240;
const PDF_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  '.csv',
  '.json',
  '.log',
  '.md',
  '.markdown',
  '.svg',
  '.text',
  '.toml',
  '.tsv',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const STRUCTURED_TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/rss+xml',
  'application/xml',
  'image/svg+xml',
  'text/csv',
  'text/html',
  'text/markdown',
  'text/plain',
  'text/tab-separated-values',
  'text/xml',
]);

export interface AttachmentSearchExtractionResult {
  searchText: string | null;
  searchSummary: string | null;
  searchStatus: AttachmentSearchStatus;
  extractedAt: number | null;
  metadata: Record<string, unknown>;
}

export function extractAttachmentSearchData(input: {
  absolutePath: string;
  mimeType: string | null;
  fileExtension: string | null;
  fileSize: number;
}): AttachmentSearchExtractionResult {
  const extractedAt = Date.now();

  try {
    const normalizedMimeType = input.mimeType?.toLowerCase() ?? null;
    const normalizedExtension = input.fileExtension?.toLowerCase() ?? null;

    if (normalizedMimeType === 'application/pdf' || normalizedExtension === '.pdf') {
      return extractPdfSearchData(input.absolutePath, extractedAt);
    }

    if (isTextLikeFile(normalizedMimeType, normalizedExtension)) {
      return extractTextSearchData({
        absolutePath: input.absolutePath,
        mimeType: normalizedMimeType,
        fileExtension: normalizedExtension,
        fileSize: input.fileSize,
        extractedAt,
      });
    }

    return {
      searchText: null,
      searchSummary: null,
      searchStatus: 'unsupported',
      extractedAt,
      metadata: {
        extractionKind: 'unsupported',
        reason: 'Unsupported attachment type for text indexing.',
      },
    };
  } catch (error) {
    return {
      searchText: null,
      searchSummary: null,
      searchStatus: 'failed',
      extractedAt,
      metadata: {
        extractionKind: 'failed',
        error: error instanceof Error ? error.message : 'Unknown extraction failure',
      },
    };
  }
}

function isTextLikeFile(mimeType: string | null, fileExtension: string | null) {
  if (mimeType?.startsWith('text/')) return true;
  if (mimeType && STRUCTURED_TEXT_MIME_TYPES.has(mimeType)) return true;
  if (fileExtension && TEXT_EXTENSIONS.has(fileExtension)) return true;
  return false;
}

function extractTextSearchData(input: {
  absolutePath: string;
  mimeType: string | null;
  fileExtension: string | null;
  fileSize: number;
  extractedAt: number;
}): AttachmentSearchExtractionResult {
  const raw = fs.readFileSync(input.absolutePath);
  const truncatedByBytes = raw.byteLength > MAX_TEXT_FILE_BYTES;
  const decoded = raw.subarray(0, Math.min(raw.byteLength, MAX_TEXT_FILE_BYTES)).toString('utf8');
  const normalized = normalizeExtractedText(transformStructuredText(decoded, input.mimeType, input.fileExtension));

  if (!normalized) {
    return {
      searchText: null,
      searchSummary: null,
      searchStatus: 'unsupported',
      extractedAt: input.extractedAt,
      metadata: {
        extractionKind: 'text',
        reason: 'No indexable text found in the attachment.',
      },
    };
  }

  const { searchText, searchSummary, truncatedByLength } = buildSearchPayload(normalized);

  return {
    searchText,
    searchSummary,
    searchStatus: 'indexed',
    extractedAt: input.extractedAt,
    metadata: {
      extractionKind: 'text',
      mimeType: input.mimeType,
      fileExtension: input.fileExtension,
      originalBytes: input.fileSize,
      indexedChars: searchText.length,
      truncated: truncatedByBytes || truncatedByLength,
    },
  };
}

function extractPdfSearchData(absolutePath: string, extractedAt: number): AttachmentSearchExtractionResult {
  try {
    const output = execFileSync(
      'pdftotext',
      ['-q', '-enc', 'UTF-8', '-nopgbrk', absolutePath, '-'],
      {
        encoding: 'utf8',
        maxBuffer: PDF_MAX_BUFFER_BYTES,
      }
    );
    const normalized = normalizeExtractedText(output);

    if (!normalized) {
      return {
        searchText: null,
        searchSummary: null,
        searchStatus: 'unsupported',
        extractedAt,
        metadata: {
          extractionKind: 'pdf',
          reason: 'No extractable text was found in this PDF.',
          extractor: 'pdftotext',
        },
      };
    }

    const { searchText, searchSummary, truncatedByLength } = buildSearchPayload(normalized);

    return {
      searchText,
      searchSummary,
      searchStatus: 'indexed',
      extractedAt,
      metadata: {
        extractionKind: 'pdf',
        extractor: 'pdftotext',
        indexedChars: searchText.length,
        truncated: truncatedByLength,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PDF extraction failure';
    const isMissingExtractor = error instanceof Error && 'code' in error && error.code === 'ENOENT';

    return {
      searchText: null,
      searchSummary: null,
      searchStatus: isMissingExtractor ? 'unsupported' : 'failed',
      extractedAt,
      metadata: {
        extractionKind: 'pdf',
        extractor: 'pdftotext',
        reason: isMissingExtractor
          ? 'pdftotext is not available on this host.'
          : 'PDF text extraction failed.',
        error: message,
      },
    };
  }
}

function buildSearchPayload(input: string) {
  const truncatedByLength = input.length > MAX_SEARCH_TEXT_LENGTH;
  const searchText = input.slice(0, MAX_SEARCH_TEXT_LENGTH);
  const searchSummary = searchText.slice(0, MAX_SUMMARY_LENGTH);

  return {
    searchText,
    searchSummary,
    truncatedByLength,
  };
}

function transformStructuredText(input: string, mimeType: string | null, fileExtension: string | null) {
  if (mimeType === 'text/html' || mimeType === 'image/svg+xml' || mimeType === 'application/xml' || fileExtension === '.svg' || fileExtension === '.xml') {
    return input.replace(/<[^>]+>/g, ' ');
  }

  return input;
}

function normalizeExtractedText(input: string) {
  return input
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
